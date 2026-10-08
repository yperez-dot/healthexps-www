/**
 * Server-side GoHighLevel enrichment for website leads.
 *
 * The GHL inbound-webhook workflows only map name / phone / email (+ Additional
 * Notes). Every other answer (health system, carrier, ZIP, looking-for, …) was
 * being dropped. After the webhook is forwarded, this module finds the contact
 * the workflow created (or creates it) and, via the GHL API:
 *   - adds a note with EVERY submitted answer + page + time
 *   - sets ZIP, source (real page), owner (if unassigned), Additional Notes
 *   - adds tags: website-lead + real page tag (+ form-provided tags) and
 *     removes the hardcoded "homepage" tag when the form was not on the homepage
 *   - makes sure an opportunity exists in the THEI Website pipeline (renames the
 *     workflow's "— Homepage" opp to the real page), owner = Yahoska
 *   - creates a "call this lead" task assigned to Yahoska (GHL notifies on assign)
 *
 * The API token lives only in the Netlify env (GHL_API_TOKEN); never in the browser.
 * All failures are logged and swallowed so a lead is never lost because of this.
 */

const API = 'https://services.leadconnectorhq.com';
const LOCATION_ID = process.env.GHL_LOCATION_ID || 'RINM4TCnM4hN06UA1aK0';
const OWNER_USER_ID = process.env.GHL_OWNER_USER_ID || 'UlTM7S5uLDmQhXQ5zzfN'; // Yahoska Perez
const WEBSITE_PIPELINE_ID = process.env.GHL_WEBSITE_PIPELINE_ID || 'iziaGFnVZle64waSZJff'; // THEI Website
const WEBSITE_NEW_LEAD_STAGE_ID =
  process.env.GHL_WEBSITE_STAGE_ID || '4ae9b05c-c74d-41ed-827b-db4f4b3be8b0'; // New Lead

const CF_ZIP_CODE = 'bgB8OLNIpvO8lXVkhMyY'; // contact.zip_code
const CF_ADDITIONAL_NOTES = 'vlaqZtJCGr1zqtOvHSX0'; // contact.additional_notes

/** Keys that are plumbing, not answers. */
const INTERNAL_KEYS = new Set([
  '_hp_name', 'honeypot', 'website', 'company_url', '_form_loaded_at', 'form_loaded_at',
  'source_key', 'webhook_id', 'page_url', 'page_path', 'form_page', 'consent', 'tags',
  'submitted_at', 'page', 'source', 'lang', 'looking_for', 'additional_notes', 'notes',
]);

const LABELS = {
  first_name: 'First name', firstName: 'First name', last_name: 'Last name', lastName: 'Last name',
  name: 'Name', full_name: 'Name', phone: 'Phone', phone_number: 'Phone', email: 'Email',
  health_system: 'Health system', current_carrier: 'Current carrier / plan',
  carrier: 'Carrier', zip_code: 'ZIP', zip: 'ZIP', zipcode: 'ZIP', postal_code: 'ZIP',
  coverage_type: 'Looking for', message: 'Message', county: 'County', dob: 'Date of birth',
  age: 'Age', language: 'Language', preferred_language: 'Preferred language',
};

function label(key) {
  if (LABELS[key]) return LABELS[key];
  const s = String(key).replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtEt(d) {
  try {
    return new Date(d).toLocaleString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) + ' ET';
  } catch (e) {
    return String(d);
  }
}

function isHomepagePath(path) {
  return ['/', '/index.html', '/es', '/es/', '/es/index.html'].includes(path || '');
}

function pageTag(path) {
  if (!path) return 'web:unknown-page';
  if (path === '/' || path === '/index.html') return 'web:homepage';
  if (['/es', '/es/', '/es/index.html'].includes(path)) return 'web:es-homepage';
  const slug = path.replace(/\.html$/, '').replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return ('web:' + slug).slice(0, 90);
}

function pageLabel(data, path) {
  const src = String(data.source || '').trim();
  if (src && !/^Homepage Form$/i.test(src)) return src;
  if (isHomepagePath(path)) return path.startsWith('/es') ? 'Spanish Homepage Form' : 'Homepage Form';
  return path ? 'Form: ' + path : 'Website form';
}

function extractZip(data) {
  for (const k of ['zip_code', 'zip', 'zipcode', 'postal_code', 'postalCode']) {
    const m = String(data[k] || '').match(/\b(\d{5})\b/);
    if (m) return m[1];
  }
  return '';
}

/** Human-readable list of every answer the visitor gave. */
function answerLines(data) {
  const lines = [];
  const seen = new Set();
  for (const [k, v] of Object.entries(data || {})) {
    if (INTERNAL_KEYS.has(k)) continue;
    if (v === undefined || v === null || typeof v === 'object') continue;
    const val = String(v).trim();
    if (!val) continue;
    const l = label(k);
    const key = l + '|' + val;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${l}: ${val}`);
  }
  const notes = String(data.additional_notes || data.notes || '').trim();
  if (notes) lines.push(`Notes: ${notes}`);
  return lines;
}

function buildNote(data, ctx) {
  const lines = [
    `🌐 WEBSITE LEAD — ${ctx.pageLabel}`,
    `Submitted: ${fmtEt(ctx.submittedAt)}`,
    `Page: ${ctx.pageUrl || ctx.path || '(unknown)'}`,
    data.lang ? `Language: ${data.lang}` : null,
    '',
    'Answers:',
    ...answerLines(data).map((l) => '• ' + l),
  ].filter((l) => l !== null);
  return lines.join('\n');
}

function makeClient(token, deadline) {
  return async function ghl(method, path, body) {
    const remaining = deadline - Date.now();
    if (remaining < 300) throw new Error('ghl deadline');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Math.min(remaining, 4000));
    try {
      const res = await fetch(API + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          Version: '2021-07-28',
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { raw: text.slice(0, 200) }; }
      if (!res.ok) {
        const err = new Error(`GHL ${method} ${path.split('?')[0]} ${res.status}: ${String(json.message || text).slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
      return json;
    } finally {
      clearTimeout(t);
    }
  };
}

async function findContact(ghl, email, phoneE164) {
  const tries = [];
  if (email) tries.push(`email=${encodeURIComponent(email)}`);
  if (phoneE164) tries.push(`number=${encodeURIComponent(phoneE164)}`);
  for (const q of tries) {
    try {
      const r = await ghl('GET', `/contacts/search/duplicate?locationId=${LOCATION_ID}&${q}`);
      if (r && r.contact && r.contact.id) return r.contact;
    } catch (e) {
      console.warn('[ghl-enrich] duplicate search failed:', e.message);
    }
  }
  return null;
}

/**
 * @param {object} data  original (spam-checked) form data
 * @param {object} payload  payload forwarded to the webhook (normalized)
 * @param {object} [opts]  { budgetMs, pollMs: [] }
 */
async function enrichLead(data, payload, opts = {}) {
  const token = process.env.GHL_API_TOKEN;
  if (!token) return { skipped: 'no_token' };
  const started = Date.now();
  const deadline = started + (opts.budgetMs || 7500);
  const ghl = makeClient(token, deadline);
  const result = { steps: [] };

  const email = String(data.email || '').trim().toLowerCase();
  const digits = String(payload.phone || data.phone || '').replace(/\D/g, '');
  const phoneE164 = digits.length === 10 ? '+1' + digits : digits.length === 11 ? '+' + digits : '';
  if (!email && !phoneE164) return { skipped: 'no_contact_method' };

  const path = String(payload.page_path || payload.form_page || '').trim();
  const ctx = {
    path,
    pageUrl: String(payload.page || payload.page_url || '').trim(),
    pageLabel: pageLabel(data, path),
    submittedAt: payload.submitted_at || new Date().toISOString(),
  };
  const zip = extractZip(data);
  const first = String(data.first_name || data.firstName || '').trim();
  const last = String(data.last_name || data.lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ') || String(data.name || data.full_name || '').trim() || email || phoneE164;

  // 1) Wait for the webhook workflow to create the contact (avoid duplicates)
  let contact = null;
  for (const wait of opts.pollMs || [700, 900, 1200, 1500]) {
    await sleep(wait);
    contact = await findContact(ghl, email, phoneE164);
    if (contact || Date.now() > deadline - 2500) break;
  }

  const answersSummary = answerLines(data).join(' | ');
  const additional = [
    String(payload.additional_notes || '').trim(),
    answersSummary ? 'Answers: ' + answersSummary : '',
  ].filter(Boolean).join('\n');

  const updates = {
    source: ctx.pageLabel.slice(0, 100),
    customFields: [{ id: CF_ADDITIONAL_NOTES, field_value: additional.slice(0, 2000) }],
  };
  if (zip) {
    updates.postalCode = zip;
    updates.customFields.push({ id: CF_ZIP_CODE, field_value: zip });
  }

  // 2) Create (upsert) if the workflow never created it, else update
  if (!contact) {
    const up = await ghl('POST', '/contacts/upsert', {
      locationId: LOCATION_ID,
      firstName: first || undefined,
      lastName: last || undefined,
      email: email || undefined,
      phone: phoneE164 || undefined,
      assignedTo: OWNER_USER_ID,
      tags: ['website-lead'],
      ...updates,
    });
    contact = up.contact || up;
    result.steps.push('upsert');
  } else {
    if (!contact.assignedTo) updates.assignedTo = OWNER_USER_ID;
    await ghl('PUT', `/contacts/${contact.id}`, updates);
    result.steps.push('update');
  }
  const contactId = contact.id;
  result.contactId = contactId;

  // 3) Tags: website-lead + real page + any form-provided tags
  const formTags = String(data.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const tags = Array.from(new Set(['website-lead', pageTag(path), ...formTags])).slice(0, 15);
  try {
    await ghl('POST', `/contacts/${contactId}/tags`, { tags });
    result.steps.push('tags');
  } catch (e) { console.warn('[ghl-enrich] tags:', e.message); }

  // 4) Note with every answer
  try {
    await ghl('POST', `/contacts/${contactId}/notes`, { body: buildNote(data, ctx), userId: OWNER_USER_ID });
    result.steps.push('note');
  } catch (e) { console.warn('[ghl-enrich] note:', e.message); }

  // 5) Task for Yahoska (assignment triggers her GHL notification)
  try {
    const due = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await ghl('POST', `/contacts/${contactId}/tasks`, {
      title: `Call new website lead: ${fullName} (${ctx.pageLabel})`.slice(0, 200),
      body: buildNote(data, ctx).slice(0, 2000),
      dueDate: due,
      completed: false,
      assignedTo: OWNER_USER_ID,
    });
    result.steps.push('task');
  } catch (e) { console.warn('[ghl-enrich] task:', e.message); }

  // 6) Opportunity in THEI Website pipeline (owner Yahoska); rename "— Homepage"
  try {
    const sinceCreate = Date.now() - new Date(contact.dateAdded || Date.now()).getTime();
    if (sinceCreate < 1500) await sleep(Math.min(1500 - sinceCreate, Math.max(0, deadline - Date.now() - 1500)));
    const opps = await ghl('GET', `/opportunities/search?location_id=${LOCATION_ID}&contact_id=${contactId}`);
    const list = (opps.opportunities || []).filter((o) => o.status === 'open' || !o.status);
    const web = list.find((o) => o.pipelineId === WEBSITE_PIPELINE_ID);
    const oppName = `${fullName} — ${ctx.pageLabel}`.slice(0, 200);
    if (web) {
      const patch = {};
      if (/—\s*Homepage$/i.test(web.name || '') && !isHomepagePath(path)) patch.name = oppName;
      if (!web.assignedTo) patch.assignedTo = OWNER_USER_ID;
      if (Object.keys(patch).length) {
        await ghl('PUT', `/opportunities/${web.id}`, patch);
        result.steps.push('opp-update');
      }
      result.opportunityId = web.id;
    } else if (!list.length) {
      const o = await ghl('POST', '/opportunities/', {
        locationId: LOCATION_ID,
        pipelineId: WEBSITE_PIPELINE_ID,
        pipelineStageId: WEBSITE_NEW_LEAD_STAGE_ID,
        name: oppName,
        status: 'open',
        contactId,
        assignedTo: OWNER_USER_ID,
        source: ctx.pageLabel.slice(0, 100),
      });
      result.opportunityId = (o.opportunity || o).id;
      result.steps.push('opp-create');
    }
  } catch (e) { console.warn('[ghl-enrich] opportunity:', e.message); }

  // 7) Drop the workflow's hardcoded "homepage" tag when the form wasn't on the homepage
  if (path && !isHomepagePath(path)) {
    try {
      const c = await ghl('GET', `/contacts/${contactId}`);
      const cur = ((c.contact || {}).tags || []).map((t) => String(t).toLowerCase());
      if (cur.includes('homepage')) {
        await ghl('DELETE', `/contacts/${contactId}/tags`, { tags: ['homepage'] });
        result.steps.push('untag-homepage');
      }
    } catch (e) { console.warn('[ghl-enrich] untag:', e.message); }
  }

  result.ms = Date.now() - started;
  return result;
}

module.exports = { enrichLead, answerLines, buildNote, pageTag, pageLabel, extractZip };
