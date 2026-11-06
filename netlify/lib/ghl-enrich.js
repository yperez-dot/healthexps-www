/**
 * Server-side GoHighLevel enrichment for website leads.
 *
 * The GHL inbound-webhook workflows only map name / phone / email (+ Additional
 * Notes). Every other answer (health system, carrier, ZIP, looking-for, …) was
 * being dropped. This module upserts (or finds) the contact first, then
 * submit-lead fires the webhook so the workflow enrolls that same record, and
 * via the GHL API:
 *   - adds a note with EVERY submitted answer + page + time
 *   - sets ZIP, source (real page), owner (if unassigned), Additional Notes
 *   - adds tags: website-lead + real page tag (+ form-provided tags) and
 *     removes the hardcoded "homepage" tag when the form was not on the homepage
 *   - makes sure an opportunity exists in the THEI Website pipeline (renames the
 *     workflow's "— Homepage" opp to the real page), owner = Yahoska
 *   - creates a "call this lead" task assigned to Yahoska (GHL notifies on assign)
 *
 * Contact identity: upsert (or find) the contact FIRST and tag it, then
 * submit-lead fires the inbound webhook so the GHL workflow's Create/Update
 * Contact + SMS enroll THAT same record — not a parallel empty contact.
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
  'message', 'reason', 'contact_reason',
  'pageUrl', 'submittedAt', 'formSource', 'channel', 'blog_title', 'blog_category', 'form_name',
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

/** Map a blog category / form key to the routing tag suffix (Medicare / ACA / Private / Life). */
function normalizeBlogCategory(value) {
  const c = String(value || '').toLowerCase();
  if (!c) return '';
  if (/\baca\b|marketplace|mercado|obamacare/.test(c)) return 'aca';
  if (/private|privado|cobra/.test(c)) return 'private';
  if (/life|vida|final expense|gastos finales/.test(c)) return 'life';
  if (/medicare|medicaid|dsnp|d-snp|aep|medigap/.test(c)) return 'medicare';
  return '';
}

const CATEGORY_BY_SOURCE_KEY = {
  'aep-2027': 'medicare', 'blog-lee-nch': 'medicare',
  'en-private': 'private', 'es-private': 'private', 'en-cobra': 'private', 'es-cobra': 'private',
  'en-aca': 'aca', 'es-aca': 'aca',
};

function humanizeSlug(slug) {
  const s = String(slug || '').replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Blog post info for /blog/<slug>/ and /es/blog/<slug>/ (not the listing pages).
 * Returns null for every non-blog path.
 */
function blogInfo(data, path) {
  const m = String(path || '').match(/^\/(es\/)?blog\/([^/?#]+?)(?:\.html)?\/?$/i);
  if (!m || /^index$/i.test(m[2])) return null;
  const d = data || {};
  const title = String(d.blog_title || '').trim() || humanizeSlug(m[2]);
  let category = normalizeBlogCategory(d.blog_category);
  if (!category) category = CATEGORY_BY_SOURCE_KEY[String(d.source_key || '').trim()] || '';
  if (!category) {
    const tags = String(d.tags || '').toLowerCase().split(',').map((t) => t.trim());
    if (tags.includes('private')) category = 'private';
    else if (tags.includes('aca')) category = 'aca';
    else if (tags.some((t) => /^aep-|medicare|network-alert|dsnp/.test(t))) category = 'medicare';
  }
  return { lang: m[1] ? 'es' : 'en', slug: m[2], title, category };
}

/** Tags every blog lead gets: "blog" + "blog-<category>" (routing by topic). */
function blogTags(info) {
  if (!info) return [];
  return ['blog', info.category ? 'blog-' + info.category : null].filter(Boolean);
}

function pageLabel(data, path) {
  const blog = blogInfo(data, path);
  if (blog) return ('Blog: ' + blog.title).slice(0, 100);
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

const LOOKING_FOR_KEYS = [
  'coverage_type', 'looking_for', 'contact_reason', 'interest', 'reason',
  'private_reason', 'aca_reason', 'help_with', 'aep_plan_type', 'need',
  'planInterest', 'plan_interest', 'planType', 'cobra_timing', 'current_coverage',
  'current_situation',
];

function extractLookingFor(data) {
  for (const key of LOOKING_FOR_KEYS) {
    const value = String((data && data[key]) || '').trim();
    if (value) return value;
  }
  return '';
}

function phoneDigits(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d;
}

function toE164(value) {
  const d = phoneDigits(value);
  return d.length === 10 ? '+1' + d : '';
}

/** Visitor-typed notes only — strips the "Form page:" line submit-lead stamps. */
function visitorNotes(data) {
  const raw = String(
    (data && (data.additional_notes || data.notes || data.message)) || ''
  ).trim();
  return raw
    .replace(/(?:\r?\n)+Form page:\s*\S+\s*$/i, '')
    .replace(/^Form page:\s*\S+\s*$/i, '')
    .trim();
}

/** Human-readable list of every answer the visitor gave. */
function answerLines(data) {
  const lines = [];
  const seen = new Set();
  // Flatten one level of nested objects (e.g. calculators send customFields: {...})
  const flat = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) flat.push([k2, v2]);
    } else if (Array.isArray(v)) {
      flat.push([k, v.filter((x) => typeof x !== 'object').join(', ')]);
    } else {
      flat.push([k, v]);
    }
  }
  for (const [k, v] of flat) {
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
  const notes = visitorNotes(data);
  if (notes) lines.push(`Notes: ${notes}`);
  return lines;
}

function buildNote(data, ctx) {
  const lines = [
    `🌐 WEBSITE LEAD — ${ctx.pageLabel}`,
    `Submitted: ${fmtEt(ctx.submittedAt)}`,
    `Page: ${ctx.pageUrl || ctx.path || '(unknown)'}`,
    ctx.formName && ctx.formName !== ctx.pageLabel ? `Form: ${ctx.formName}` : null,
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

async function findContact(ghl, email, phoneE164, digits10) {
  const tries = [];
  if (email) tries.push(`email=${encodeURIComponent(email)}`);
  if (phoneE164) tries.push(`number=${encodeURIComponent(phoneE164)}`);
  if (digits10) {
    if (!phoneE164 || digits10 !== phoneE164.replace(/\D/g, '').slice(-10)) {
      tries.push(`number=${encodeURIComponent(digits10)}`);
    }
    tries.push(`number=${encodeURIComponent('+1' + digits10)}`);
    tries.push(`number=${encodeURIComponent('1' + digits10)}`);
  }
  const seen = new Set();
  for (const q of tries) {
    if (seen.has(q)) continue;
    seen.add(q);
    try {
      const r = await ghl('GET', `/contacts/search/duplicate?locationId=${LOCATION_ID}&${q}`);
      if (r && r.contact && r.contact.id) return r.contact;
    } catch (e) {
      console.warn('[ghl-enrich] duplicate search failed:', e.message);
    }
  }
  // Duplicate-search misses when the location allows duplicates or the
  // webhook stored a different phone format — try a plain query lookup.
  for (const q of [email, phoneE164, digits10].filter(Boolean)) {
    try {
      const r = await ghl(
        'GET',
        `/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(q)}`
      );
      const hit = (r.contacts || []).find((c) => c && c.id);
      if (hit) return hit;
    } catch (e) {
      console.warn('[ghl-enrich] contact query failed:', e.message);
    }
  }
  return null;
}

/**
 * @param {object} data  original (spam-checked) form data
 * @param {object} payload  payload forwarded to the webhook (normalized)
 * @param {object} [opts]  { budgetMs, pollMs: [] }
 *   Default poll is one immediate lookup (no wait). submit-lead upserts first,
 *   then fires the webhook so we are not racing a second contact into existence.
 */
async function enrichLead(data, payload, opts = {}) {
  const token = process.env.GHL_API_TOKEN;
  if (!token) return { skipped: 'no_token' };
  const started = Date.now();
  const deadline = started + (opts.budgetMs || 7500);
  const ghl = makeClient(token, deadline);
  const result = { steps: [] };

  const email = String(data.email || '').trim().toLowerCase();
  const digits = phoneDigits(payload.phone || data.phone || data.phone_number);
  const phoneE164 = toE164(payload.phone || data.phone || data.phone_number);
  if (!email && !phoneE164) return { skipped: 'no_contact_method' };

  const path = String(payload.page_path || payload.form_page || '').trim();
  const ctx = {
    path,
    pageUrl: String(payload.page || payload.page_url || '').trim(),
    pageLabel: pageLabel(data, path),
    formName: String(data.source || '').trim(),
    submittedAt: payload.submitted_at || new Date().toISOString(),
  };
  const blog = blogInfo(data, path);
  const zip = extractZip(data);
  const first = String(data.first_name || data.firstName || '').trim();
  const last = String(data.last_name || data.lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ') || String(data.name || data.full_name || '').trim() || email || phoneE164;

  // 1) Find an existing contact (any phone format), else upsert. Do not wait
  //    for the inbound webhook — that used to create a *second* contact the
  //    workflow enrolled, while Yahoska opened the API-created one.
  let contact = null;
  const waits = Array.isArray(opts.pollMs) ? opts.pollMs : [0];
  for (const wait of waits) {
    if (wait) await sleep(wait);
    contact = await findContact(ghl, email, phoneE164, digits);
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
  let createdByUs = false;
  if (!contact) {
    const up = await ghl('POST', '/contacts/upsert', {
      locationId: LOCATION_ID,
      firstName: first || undefined,
      lastName: last || undefined,
      name: fullName || undefined,
      email: email || undefined,
      phone: phoneE164 || undefined,
      assignedTo: OWNER_USER_ID,
      tags: ['website-lead'],
      createNewIfDuplicateAllowed: false,
      ...updates,
    });
    contact = up.contact || up;
    createdByUs = true;
    result.steps.push('upsert');
  } else {
    if (!contact.assignedTo) updates.assignedTo = OWNER_USER_ID;
    await ghl('PUT', `/contacts/${contact.id}`, updates);
    result.steps.push('update');
  }
  const contactId = contact.id;
  result.contactId = contactId;
  result.pageLabel = ctx.pageLabel;
  // Suppress repeat alerts: calculators/quizzes post several times per visit.
  // If we already logged a website-lead note on this contact in the last 30 min,
  // still save everything but don't text/email again.
  try {
    const recent = await ghl('GET', `/contacts/${contactId}/notes`);
    const cutoff = Date.now() - 30 * 60 * 1000;
    result.repeat = (recent.notes || []).some((n) =>
      /^🌐 WEBSITE LEAD/.test(String(n.body || '')) && new Date(n.dateAdded || 0).getTime() > cutoff);
  } catch (e) { /* ignore */ }
  // 3) Tags BEFORE the inbound webhook (onContact) so a workflow Tag
  //    condition sees website-lead / web:<page> on this contact, not a
  //    throwaway enrollment that then gets removed.
  const formTags = String(data.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const reviewTags = formTags.filter((t) => t === 'needs-review' || t.startsWith('review:'));
  const tags = Array.from(new Set(['website-lead', ...reviewTags, pageTag(path), ...blogTags(blog), ...formTags])).slice(0, 15);
  try {
    await ghl('POST', `/contacts/${contactId}/tags`, { tags });
    result.steps.push('tags');
  } catch (e) { console.warn('[ghl-enrich] tags:', e.message); }

  if (typeof opts.onContact === 'function' && !result.repeat) {
    try { await opts.onContact({ contactId, pageLabel: ctx.pageLabel }); } catch (e) { /* never block */ }
  }

  // 4–6 run in parallel to stay inside the 10s function limit
  // 4) Note with every answer
  const stepNote = (async () => { try {
    await ghl('POST', `/contacts/${contactId}/notes`, { body: buildNote(data, ctx), userId: OWNER_USER_ID });
    result.steps.push('note');
  } catch (e) { console.warn('[ghl-enrich] note:', e.message); } })();

  // 5) Task for Yahoska (assignment triggers her GHL notification)
  const stepTask = (async () => { try {
    const due = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await ghl('POST', `/contacts/${contactId}/tasks`, {
      title: `Call new website lead: ${fullName} (${ctx.pageLabel})`.slice(0, 200),
      body: buildNote(data, ctx).slice(0, 2000),
      dueDate: due,
      completed: false,
      assignedTo: OWNER_USER_ID,
    });
    result.steps.push('task');
  } catch (e) { console.warn('[ghl-enrich] task:', e.message); } })();

  // 6) Opportunity in THEI Website pipeline (owner Yahoska); rename "— Homepage"
  const stepOpp = (async () => { try {
    // Webhook (fired from onContact) may still be creating its opp.
    const searchOpps = async () => {
      const r = await ghl('GET', `/opportunities/search?location_id=${LOCATION_ID}&contact_id=${contactId}`);
      return (r.opportunities || []).filter((o) => o.status === 'open' || !o.status);
    };
    let list = await searchOpps();
    // One short retry: the webhook (already fired from onContact) may still be
    // creating its opp. blog-lead-cleanup catches anything that lands later.
    if (!list.length && deadline - Date.now() > 1800) {
      await sleep(createdByUs ? 500 : 700);
      list = await searchOpps();
    }
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
  } catch (e) { console.warn('[ghl-enrich] opportunity:', e.message); } })();
  await Promise.all([stepNote, stepTask, stepOpp]);

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

module.exports = {
  enrichLead, answerLines, buildNote, pageTag, pageLabel, extractZip,
  blogInfo, blogTags, normalizeBlogCategory, makeClient, isHomepagePath,
  visitorNotes, extractLookingFor, phoneDigits, toE164,
  LOCATION_ID, WEBSITE_PIPELINE_ID,
};
