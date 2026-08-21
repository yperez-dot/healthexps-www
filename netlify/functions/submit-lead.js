/**
 * Lead submission proxy with anti-bot checks.
 * Forms POST here instead of directly to GoHighLevel webhooks so spam can be
 * filtered server-side (honeypot, timing, phone, name, notes, disposable email).
 *
 * Spam is rejected with HTTP 200 + { ok: true, filtered: true } so bots do not
 * retry; legitimate failures still return 4xx/5xx.
 */

const GHL_BASE =
  'https://services.leadconnectorhq.com/hooks/RINM4TCnM4hN06UA1aK0/webhook-trigger';

/** Map stable form source keys → GHL webhook IDs (kept off public HTML actions). */
const WEBHOOKS = {
  'es-contact': 'VIGENUzik6Z1M83Y5cea',
  'en-contact': '1238c14d-f70a-49d5-a409-32d8e055d735',
  'es-cobra': '520e997b-69a4-4330-b3d9-96b452af28bf',
  'es-aca': 'cNWs0DqK73DvGCTLzGHI',
  'es-private': 'FklcK7rZSNfB9SlLueOm',
};

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
  // NANP: 10 digits, area code cannot start with 0 or 1
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
  // Keyboard-smash notes usually have very few vowels
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

  // Identical first/last (common bot pattern: "TimothyborOl TimothyborOl")
  if (f.toLowerCase() === l.toLowerCase() && f.length >= 6) return true;

  // No spaces and mixed case with digits, or long run of consonants
  const combined = f + l;
  if (/\d/.test(combined) && /[A-Za-z]/.test(combined) && combined.length >= 10) {
    return true;
  }

  return false;
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
  // Netlify preview / local without Origin still allowed if Referer missing in same-site fetch
  // Deny empty both for non-browser scrapers hitting the function cold.
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
  // Forms open for days then submitted is fine; reject absurdly old timestamps (> 24h)
  if (now - loadedAt > 24 * 60 * 60 * 1000) return 'stale_timing';

  const first = String(data.first_name || '').trim();
  const last = String(data.last_name || '').trim();
  const phone = String(data.phone || '').trim();
  const email = String(data.email || '').trim();
  const notes = String(
    data.additional_notes || data.notes || data.message || ''
  ).trim();

  if (!first || !last || !phone || !email) return 'missing_fields';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'bad_email';
  if (DISPOSABLE_EMAIL_DOMAINS.has(emailDomain(email))) return 'disposable_email';
  if (!isValidUsPhone(phone)) return 'bad_phone';
  if (looksLikeBotName(first, last)) return 'bot_name';
  if (looksLikeGibberish(notes)) return 'gibberish_notes';

  return null;
}

function buildForwardPayload(data) {
  // Strip anti-bot meta fields before forwarding to GHL
  const skip = new Set([
    '_hp_name',
    'honeypot',
    'website',
    'company_url',
    '_form_loaded_at',
    'form_loaded_at',
    'source_key',
  ]);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  out.phone = normalizePhone(data.phone);
  out.submitted_at = out.submitted_at || new Date().toISOString();
  out.page = out.page || '';
  return out;
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
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const sourceKey = String(data.source_key || '').trim();
  const webhookId = WEBHOOKS[sourceKey];
  if (!webhookId) {
    return json(400, { ok: false, error: 'Unknown form source' });
  }

  const spamReason = assessSpam(data);
  if (spamReason) {
    return okFiltered(spamReason);
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
