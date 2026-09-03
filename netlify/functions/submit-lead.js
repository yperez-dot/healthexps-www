/**
 * Lead submission proxy with anti-bot checks.
 * Forms POST here instead of directly to GoHighLevel webhooks so spam can be
 * filtered server-side (honeypot, timing, phone, name, notes, disposable email).
 *
 * Accepts either:
 *   - source_key (mapped below), or
 *   - webhook_id (must be in ALLOWED_WEBHOOK_IDS)
 *
 * Spam is rejected with HTTP 200 + { ok: true, filtered: true } so bots do not
 * retry; legitimate failures still return 4xx/5xx.
 */

const GHL_BASE =
  'https://services.leadconnectorhq.com/hooks/RINM4TCnM4hN06UA1aK0/webhook-trigger';

/** Map stable form source keys → GHL webhook IDs. */
const WEBHOOKS = {
  'es-contact': 'VIGENUzik6Z1M83Y5cea',
  'en-contact': '1238c14d-f70a-49d5-a409-32d8e055d735',
  'es-cobra': '520e997b-69a4-4330-b3d9-96b452af28bf',
  'es-aca': 'cNWs0DqK73DvGCTLzGHI',
  'es-private': 'FklcK7rZSNfB9SlLueOm',
  'en-private': '9eebf549-c131-4d43-8432-0f6628211899',
  'aep-2027': 'dc6c8b35-9480-412e-b56d-4a4c8c7bd438',
};

/**
 * All known site webhook IDs (EN + ES lead forms, quizzes, calculators, blog CTAs).
 * Sitewide fetch interceptor sends webhook_id from the original GHL URL.
 */
const ALLOWED_WEBHOOK_IDS = new Set([
  ...Object.values(WEBHOOKS),
  'dc6c8b35-9480-412e-b56d-4a4c8c7bd438', // primary EN lead form
  'c3ed8125-4847-4ebb-aca6-a5aa7817b557', // quiz / find-my-plan EN
  'd36da03c-e92a-424a-9767-babcc77e884f', // quiz / find-my-plan ES
  'e656a512-d15b-409c-924d-bb3d4627ed9f', // buscador-de-planes
  '9eebf549-c131-4d43-8432-0f6628211899', // private health EN
  '961af3bd-5a04-415f-9c59-6ada70219a4f', // life insurance calculator
  '28058d00-7965-45e2-ae3c-e37459f9464b',
  'd70d8962-255a-4c3a-acee-b8d5c26b6d2e',
  'avmed-transition',
]);

const ALLOWED_ORIGINS = [
  'https://healthexps.com',
  'https://www.healthexps.com',
  'http://localhost:8080',
  'http://localhost:8888',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8888',
];

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'gmx.us',
  'gmx.com',
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'yopmail.com',
  'sharklasers.com',
  'trashmail.com',
  'discard.email',
  'getnada.com',
  'emailondeck.com',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function okFiltered(reason) {
  console.log('[submit-lead] filtered:', reason);
  return json(200, { ok: true, filtered: true });
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhone(phone) {
  let d = digitsOnly(phone);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d;
}

function isValidUsPhone(phone) {
  const d = normalizePhone(phone);
  return d.length === 10 && d[0] >= '2' && d[0] <= '9' && d[3] >= '2' && d[3] <= '9';
}

function emailDomain(email) {
  const at = String(email || '').toLowerCase().lastIndexOf('@');
  if (at < 0) return '';
  return String(email).toLowerCase().slice(at + 1).trim();
}

function looksLikeGibberish(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 20) return false;

  const letters = s.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 16) return false;

  const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
  const vowelRatio = vowels / letters.length;
  if (vowelRatio < 0.18) return true;

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    const nonsense = words.filter((w) => {
      const onlyAlpha = w.replace(/[^a-zA-Z]/g, '');
      if (onlyAlpha.length < 5) return false;
      const v = (onlyAlpha.match(/[aeiouAEIOU]/g) || []).length;
      return v / onlyAlpha.length < 0.2;
    });
    if (nonsense.length / words.length >= 0.6) return true;
  }

  return false;
}

function looksLikeBotName(first, last) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  if (!f || !l) return true;
  if (f.length > 48 || l.length > 48) return true;
  if (f.toLowerCase() === l.toLowerCase() && f.length >= 6) return true;
  const combined = f + l;
  if (containsPromoSpam(combined)) return true;
  if (/\d/.test(combined) && /[A-Za-z]/.test(combined) && combined.length >= 10) {
    return true;
  }
  return false;
}

/** Fields that legitimately contain URLs (page attribution) — do not scan. */
const SKIP_PROMO_KEYS = new Set([
  'page',
  'page_url',
  'page_path',
  'form_page',
  'source',
  'submitted_at',
  'webhook_id',
  'source_key',
  '_form_loaded_at',
  'form_loaded_at',
]);

/**
 * Crypto-faucet / URL-in-name spam (e.g. "📈 +2.84 BTC. GET -> Graph.org/Mining-…").
 * Does not scan page/source fields, which contain the real site URL.
 */
function containsPromoSpam(text) {
  const s = String(text || '');
  if (!s) return false;
  if (/https?:\/\//i.test(s)) return true;
  if (/\bwww\./i.test(s)) return true;
  if (/\bgraph\.org\b/i.test(s)) return true;
  if (/\bt\.me\//i.test(s)) return true;
  if (/\b(?:bit\.ly|tinyurl\.com|goo\.gl)\b/i.test(s)) return true;
  if (/\.[a-z]{2,}\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/.test(s)) return true;
  if (/\b(?:\d+[.,]\d+\s*)?BTC\b/i.test(s) && /(?:GET\s*->|mining|wallet|graph\.org)/i.test(s)) {
    return true;
  }
  if (
    /\b(?:bitcoin|ethereum|usdt|crypto)\b/i.test(s) &&
    /(?:https?:|www\.|wallet|mining)/i.test(s)
  ) {
    return true;
  }
  return false;
}

function collectLeadText(data) {
  const parts = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (SKIP_PROMO_KEYS.has(k)) continue;
    if (typeof v === 'string') parts.push(v);
  }
  return parts.join('\n');
}

/** Field names used across EN/ES contact & lead forms for “what do you need?” */
const LOOKING_FOR_KEYS = [
  'coverage_type',
  'looking_for',
  'contact_reason',
  'interest',
  'reason',
  'private_reason',
  'aca_reason',
  'help_with',
  'aep_plan_type',
];

/**
 * Webhooks that are quizzes/calculators — may not include a looking-for select.
 * All other full contact leads must include one.
 */
const EXEMPT_LOOKING_FOR_WEBHOOKS = new Set([
  'c3ed8125-4847-4ebb-aca6-a5aa7817b557', // quiz / find-my-plan EN
  'd36da03c-e92a-424a-9767-babcc77e884f', // quiz / find-my-plan ES
  'e656a512-d15b-409c-924d-bb3d4627ed9f', // buscador-de-planes
  '961af3bd-5a04-415f-9c59-6ada70219a4f', // life insurance calculator
]);

function extractLookingFor(data) {
  for (const key of LOOKING_FOR_KEYS) {
    const value = String(data[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function isFullContactLead(data) {
  const first = String(data.first_name || data.firstName || '').trim();
  const last = String(data.last_name || data.lastName || '').trim();
  const phone = String(data.phone || data.phone_number || '').trim();
  return Boolean(first && last && phone);
}

function isAllowedOrigin(event) {
  const origin = event.headers.origin || '';
  const referer = event.headers.referer || event.headers.referrer || '';
  if (ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + '/'))) {
    return true;
  }
  if (ALLOWED_ORIGINS.some((o) => referer.startsWith(o))) {
    return true;
  }
  return false;
}

function assessSpam(data) {
  if (data._hp_name || data.honeypot || data.website || data.company_url) {
    return 'honeypot';
  }

  const loadedAt = Number(data._form_loaded_at || data.form_loaded_at || 0);
  const now = Date.now();
  if (!loadedAt || loadedAt > now + 5000) return 'missing_or_future_timing';
  if (now - loadedAt < 3000) return 'too_fast';
  if (now - loadedAt > 24 * 60 * 60 * 1000) return 'stale_timing';

  const first = String(data.first_name || data.firstName || '').trim();
  const last = String(data.last_name || data.lastName || '').trim();
  const phone = String(data.phone || data.phone_number || '').trim();
  const email = String(data.email || '').trim();
  const notes = String(
    data.additional_notes || data.notes || data.message || ''
  ).trim();

  // Need at least one contact method (calculator partials may be email-only)
  if (!phone && !email) return 'missing_contact';

  if (phone && !isValidUsPhone(phone)) return 'bad_phone';

  // When both name parts exist, reject bot-like duplicates
  if (first && last && looksLikeBotName(first, last)) return 'bot_name';

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'bad_email';
    if (DISPOSABLE_EMAIL_DOMAINS.has(emailDomain(email))) return 'disposable_email';
  }

  if (looksLikeGibberish(notes)) return 'gibberish_notes';

  const displayName = [first, last, data.name, data.full_name].filter(Boolean).join(' ');
  if (containsPromoSpam(displayName) || containsPromoSpam(collectLeadText(data))) {
    return 'promo_spam';
  }

  return null;
}

function pathFromPage(page) {
  const raw = String(page || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).pathname || '/';
  } catch (e) {
    /* ignore */
  }
  if (raw.startsWith('/')) return raw.split('?')[0].split('#')[0] || '/';
  return '';
}

function isHomepagePath(path) {
  return (
    path === '/' ||
    path === '/index.html' ||
    path === '/es' ||
    path === '/es/' ||
    path === '/es/index.html'
  );
}

function buildForwardPayload(data) {
  const skip = new Set([
    '_hp_name',
    'honeypot',
    'website',
    'company_url',
    '_form_loaded_at',
    'form_loaded_at',
    'source_key',
    'webhook_id',
  ]);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  if (data.phone || data.phone_number) {
    out.phone = normalizePhone(data.phone || data.phone_number);
  }
  // Normalize so GHL “Looking for” always receives a value regardless of form field name
  const looking = extractLookingFor(data);
  if (looking) {
    out.coverage_type = looking;
    out.looking_for = looking;
  }

  // Always stamp which page the form was filled on
  const page = String(data.page || data.page_url || out.page || out.page_url || '').trim();
  const path =
    String(data.page_path || data.form_page || out.page_path || out.form_page || '').trim() ||
    pathFromPage(page);
  if (page) {
    out.page = page;
    out.page_url = page;
  }
  if (path) {
    out.page_path = path;
    out.form_page = path;
  }

  // Fix misleading "Homepage Form" source when the real path is not home
  const src = String(out.source || '').trim();
  if (/^Homepage Form$/i.test(src) && path && !isHomepagePath(path)) {
    out.source = 'Form: ' + path;
  }

  // Surface page in Additional Notes so existing GHL alerts show it
  const pageLine = path || page;
  if (pageLine) {
    const existing = String(
      out.additional_notes || out.notes || out.message || ''
    ).trim();
    if (!/Form page:/i.test(existing)) {
      const stamped = existing
        ? existing + '\n\nForm page: ' + pageLine
        : 'Form page: ' + pageLine;
      out.additional_notes = stamped;
      if (Object.prototype.hasOwnProperty.call(data, 'notes') || out.notes) {
        out.notes = stamped;
      }
    }
  }

  out.submitted_at = out.submitted_at || new Date().toISOString();
  out.page = out.page || page || '';
  return out;
}

function resolveWebhookId(data) {
  const sourceKey = String(data.source_key || '').trim();
  if (sourceKey && WEBHOOKS[sourceKey]) return WEBHOOKS[sourceKey];

  const webhookId = String(data.webhook_id || '').trim();
  if (webhookId && ALLOWED_WEBHOOK_IDS.has(webhookId)) return webhookId;

  return null;
}

function parseRequestBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : String(event.body || '');
  const ct = String(
    event.headers['content-type'] || event.headers['Content-Type'] || ''
  ).toLowerCase();

  if (ct.includes('application/x-www-form-urlencoded')) {
    const obj = {};
    new URLSearchParams(raw).forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  return JSON.parse(raw || '{}');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  if (!isAllowedOrigin(event)) {
    return json(403, { ok: false, error: 'Forbidden' });
  }

  let data;
  try {
    data = parseRequestBody(event);
  } catch (e) {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const webhookId = resolveWebhookId(data);
  if (!webhookId) {
    return json(400, { ok: false, error: 'Unknown form source' });
  }

  const spamReason = assessSpam(data);
  if (spamReason) {
    return okFiltered(spamReason);
  }

  // Full name+phone leads must say what they need help with (blocks empty “Looking for”)
  if (
    !EXEMPT_LOOKING_FOR_WEBHOOKS.has(webhookId) &&
    isFullContactLead(data) &&
    !extractLookingFor(data)
  ) {
    console.log('[submit-lead] rejected: missing_looking_for');
    return json(400, { ok: false, error: 'missing_looking_for' });
  }

  const payload = buildForwardPayload(data);

  try {
    const res = await fetch(`${GHL_BASE}/${webhookId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[submit-lead] GHL error', res.status, text.slice(0, 300));
      return json(502, { ok: false, error: 'Upstream error' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('[submit-lead] fetch failed', err);
    return json(500, { ok: false, error: 'Submit failed' });
  }
};

exports.assessSpam = assessSpam;
exports.containsPromoSpam = containsPromoSpam;
exports.isValidUsPhone = isValidUsPhone;
exports.parseRequestBody = parseRequestBody;
exports.WEBHOOKS = WEBHOOKS;
