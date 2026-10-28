/**
 * Scheduled safety net for blog leads (runs every 10 minutes, see netlify.toml).
 *
 * Blog post forms still post to the GHL "Homepage Lead" workflow webhook. That
 * workflow names the opportunity "<NAME> — Homepage" and may add a "homepage"
 * tag a few seconds AFTER submit-lead has finished its enrichment, so the
 * rename in ghl-enrich.js can miss it. This sweep finds open "— Homepage"
 * opportunities in the THEI Website pipeline from the last 3 days whose
 * contact was labeled as a blog lead (tag "blog" or source "Blog: …"), renames
 * the opportunity to "<NAME> — Blog: <post title>" and removes the "homepage"
 * tag. Real homepage leads are never touched.
 *
 * Uses GHL_API_TOKEN from the Netlify env only. Never logs tokens or lead data.
 */

const { makeClient, LOCATION_ID, WEBSITE_PIPELINE_ID } = require('../lib/ghl-enrich');

const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_FIXES = 25;

function isBlogContact(contact) {
  const tags = (contact.tags || []).map((t) => String(t).toLowerCase());
  return tags.includes('blog') || /^Blog:/i.test(String(contact.source || ''));
}

function blogLabel(contact) {
  const src = String(contact.source || '').trim();
  return /^Blog:/i.test(src) ? src : 'Blog';
}

async function sweep(opts = {}) {
  const token = process.env.GHL_API_TOKEN;
  if (!token) return { skipped: 'no_token' };
  const now = opts.now || Date.now();
  const ghl = makeClient(token, now + (opts.budgetMs || 25000));
  const result = { checked: 0, renamed: 0, untagged: 0 };

  const r = await ghl(
    'GET',
    `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${WEBSITE_PIPELINE_ID}` +
      `&status=open&q=${encodeURIComponent('Homepage')}&limit=100`
  );
  const candidates = (r.opportunities || []).filter((o) => {
    if (!/—\s*Homepage$/i.test(String(o.name || ''))) return false;
    const created = new Date(o.createdAt || o.dateAdded || 0).getTime();
    return created && now - created < LOOKBACK_MS;
  });

  for (const o of candidates.slice(0, MAX_FIXES)) {
    const contactId = o.contactId || (o.contact && o.contact.id);
    if (!contactId) continue;
    result.checked++;
    try {
      const c = await ghl('GET', `/contacts/${contactId}`);
      const contact = c.contact || c;
      if (!isBlogContact(contact)) continue;
      const base = String(o.name).replace(/\s*—\s*Homepage$/i, '').trim();
      await ghl('PUT', `/opportunities/${o.id}`, { name: `${base} — ${blogLabel(contact)}`.slice(0, 200) });
      result.renamed++;
      const tags = (contact.tags || []).map((t) => String(t).toLowerCase());
      if (tags.includes('homepage')) {
        await ghl('DELETE', `/contacts/${contactId}/tags`, { tags: ['homepage'] });
        result.untagged++;
      }
    } catch (e) {
      console.warn('[blog-lead-cleanup]', e.message);
    }
  }
  return result;
}

exports.handler = async () => {
  try {
    const res = await sweep();
    console.log('[blog-lead-cleanup]', JSON.stringify(res));
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('[blog-lead-cleanup] failed', e && e.message);
    return { statusCode: 200, body: JSON.stringify({ ok: false }) };
  }
};

exports.sweep = sweep;
exports.isBlogContact = isBlogContact;
