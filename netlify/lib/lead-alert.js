/**
 * Instant "new website lead" alert to Yahoska — NEVER to the lead.
 *
 * Channels (each env-gated, run in parallel, short timeout, errors swallowed):
 *  1. Email via GHL Conversations API, addressed to Yahoska's own GHL contact
 *     (GHL_ALERT_CONTACT_ID, yperez@healthexps.com). Uses GHL_API_TOKEN.
 *     Fallback (only if GHL email fails and ALERT_SMTP_USER/PASS are set):
 *     SMTP to yperez@healthexps.com.
 *  2. SMS from the GHL location number to Yahoska and Katy Robles, sent to their
 *     own GHL "notification" contacts (the records GHL already uses for internal
 *     lead texts, keyed to their user phone numbers) — never to a lead's thread.
 *
 * Recipients are fixed server-side; nothing from the form can change them.
 */
const { answerLines } = require('./ghl-enrich');

const LOCATION_ID = process.env.GHL_LOCATION_ID || 'RINM4TCnM4hN06UA1aK0';
const ALERT_CONTACT_ID = process.env.GHL_ALERT_CONTACT_ID || 'CVRw8qHNJec4GhdFWpqh'; // Yahoska's own contact
const ALERT_EMAIL = 'yperez@healthexps.com';
/** Staff SMS recipients: GHL notification contacts for their user cell numbers. */
const SMS_RECIPIENTS = [
  { who: 'Yahoska Perez', contactId: process.env.GHL_SMS_YAHOSKA_CONTACT_ID || 'N4vBOAjkwUc4J8WvX7Y6', phone: '+17862027078' },
  { who: 'Katy Robles', contactId: process.env.GHL_SMS_KATY_CONTACT_ID || 'RPjpI9w6rbYG8rkQ0dlc', phone: '+17869717125' },
];
const IDENTITY_KEYS = new Set(['first_name', 'firstName', 'last_name', 'lastName', 'name', 'full_name', 'phone', 'phone_number', 'email']);

function fmtEt(d) {
  try {
    return new Date(d).toLocaleString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) + ' ET';
  } catch (e) { return String(d); }
}

function shortPage(path) {
  const p = String(path || '');
  if (p === '/' || p === '/index.html') return 'Homepage';
  if (['/es', '/es/', '/es/index.html'].includes(p)) return 'ES homepage';
  const seg = p.replace(/\.html$/, '').replace(/\/+$/, '').split('/').filter(Boolean);
  const last = seg[seg.length - 1] || p;
  return ((seg[0] === 'es' ? 'ES ' : '') + last.replace(/-/g, ' ')).slice(0, 45);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildAlert(data, payload, info) {
  const first = String(data.first_name || data.firstName || '').trim();
  const last = String(data.last_name || data.lastName || '').trim();
  const name = [first, last].filter(Boolean).join(' ') || String(data.name || data.full_name || data.email || 'Unknown').trim();
  const page = String(payload.page_path || payload.form_page || '').trim() || '(unknown page)';
  const pageUrl = String(payload.page || payload.page_url || '').trim();
  const label = (info && info.pageLabel) || page;
  const when = fmtEt(payload.submitted_at || Date.now());
  const link = info && info.contactId
    ? `https://app.gohighlevel.com/v2/location/${LOCATION_ID}/contacts/detail/${info.contactId}`
    : '';
  const answers = answerLines(data);
  const subject = `NEW WEBSITE LEAD: ${name} (${label})`.slice(0, 200);
  const text = [
    `🔔 NEW WEBSITE LEAD — ${name}`,
    `Phone: ${data.phone || data.phone_number || '—'}`,
    `Email: ${data.email || '—'}`,
    `Form: ${label}`,
    `Page: ${pageUrl || page}`,
    `Time: ${when}`,
    '',
    'Answers:',
    ...answers.map((a) => '• ' + a),
    '',
    link ? `GHL contact: ${link}` : 'GHL contact: (search by phone/email)',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px">
<h2 style="color:#452068;margin:0 0 8px">🔔 New website lead: ${esc(name)}</h2>
<p style="margin:0 0 12px"><b>Phone:</b> ${esc(data.phone || data.phone_number || '—')}<br>
<b>Email:</b> ${esc(data.email || '—')}<br><b>Form:</b> ${esc(label)}<br>
<b>Page:</b> ${esc(pageUrl || page)}<br><b>Time:</b> ${esc(when)}</p>
<p style="margin:0 0 4px"><b>Answers</b></p><ul style="margin-top:0">${answers.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
${link ? `<p><a href="${esc(link)}" style="background:#ff1090;color:#fff;padding:10px 16px;border-radius:20px;text-decoration:none;font-weight:bold">Open in GHL</a></p>` : ''}
<p style="color:#888;font-size:12px">Automatic alert from the healthexps.com lead form. Nothing was sent to the lead. Yahoska and Katy also got a text.</p></div>`;
  const short = shortPage(page);
  const keyVals = answers
    .filter((l) => !/^(First name|Last name|Name|Phone|Email):/.test(l))
    .map((l) => l.replace(/^[^:]+:\s*/, ''));
  const sms = `New website lead: ${name} ${data.phone || data.phone_number || ''} - ${short}${keyVals.length ? ' - ' + keyVals.join(', ') : ''}`
    .replace(/\s+/g, ' ').trim().slice(0, 300);
  return { subject, text, html, name, sms };
}

async function withTimeout(promiseFactory, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await promiseFactory(ctrl.signal); } finally { clearTimeout(t); }
}

async function sendGhlEmail(alert, ms, leadContactId) {
  const token = process.env.GHL_API_TOKEN;
  if (!token) return 'skip:no_token';
  if (leadContactId && leadContactId === ALERT_CONTACT_ID) return 'skip:lead_is_alert_contact';
  return withTimeout(async (signal) => {
    const res = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Version: '2021-04-15', 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type: 'Email', contactId: ALERT_CONTACT_ID, subject: alert.subject, html: alert.html, message: alert.text }),
      signal,
    });
    if (!res.ok) throw new Error('ghl email ' + res.status + ' ' + (await res.text()).slice(0, 160));
    return 'ok';
  }, ms);
}

async function sendSmtpEmail(alert, ms) {
  const user = process.env.ALERT_SMTP_USER;
  const pass = process.env.ALERT_SMTP_PASS;
  if (!user || !pass) return 'skip:no_smtp';
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.ALERT_SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.ALERT_SMTP_PORT || 587),
    secure: false, auth: { user, pass }, connectionTimeout: ms, greetingTimeout: ms, socketTimeout: ms,
  });
  await Promise.race([
    transporter.sendMail({ from: '"healthexps.com Leads" <info@healthexps.com>', to: ALERT_EMAIL, subject: alert.subject, text: alert.text, html: alert.html }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('smtp timeout')), ms)),
  ]);
  return 'ok';
}

async function sendGhlSms(alert, ms, leadContactId, leadPhone) {
  const token = process.env.GHL_API_TOKEN;
  if (!token) return { all: 'skip:no_token' };
  const out = {};
  await Promise.all(SMS_RECIPIENTS.map(async (r) => {
    if (!r.contactId) { out[r.who] = 'skip:no_contact'; return; }
    if (r.contactId === leadContactId || (leadPhone && leadPhone === r.phone)) { out[r.who] = 'skip:lead_is_staff'; return; }
    try {
      out[r.who] = await withTimeout(async (signal) => {
        const res = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, Version: '2021-04-15', 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ type: 'SMS', contactId: r.contactId, message: alert.sms }),
          signal,
        });
        const body = await res.text();
        if (!res.ok) throw new Error(res.status + ' ' + body.slice(0, 120));
        let id = '';
        try { id = JSON.parse(body).messageId || ''; } catch (e) { /* ignore */ }
        return 'ok' + (id ? ':' + id : '');
      }, ms);
    } catch (e) { out[r.who] = 'error:' + e.message; }
  }));
  return out;
}

/** Send all alerts in parallel; resolves with per-channel status, never throws. */
async function sendLeadAlert(data, payload, info = {}, opts = {}) {
  const ms = Math.max(800, Math.min(opts.timeoutMs || 2500, 3500));
  const alert = buildAlert(data, payload, info);
  const out = {};
  const email = (async () => {
    try {
      out.email_ghl = await sendGhlEmail(alert, ms, info.contactId);
    } catch (e) {
      out.email_ghl = 'error:' + e.message;
      try { out.email_smtp = await sendSmtpEmail(alert, ms); } catch (e2) { out.email_smtp = 'error:' + e2.message; }
    }
  })();
  const digits = String(data.phone || data.phone_number || '').replace(/\D/g, '');
  const leadPhone = digits.length === 10 ? '+1' + digits : digits.length === 11 ? '+' + digits : '';
  const sms = (async () => {
    try { out.sms = await sendGhlSms(alert, ms, info.contactId, leadPhone); } catch (e) { out.sms = 'error:' + e.message; }
  })();
  await Promise.allSettled([email, sms]);
  return out;
}

module.exports = { sendLeadAlert, buildAlert, ALERT_CONTACT_ID, SMS_RECIPIENTS };
