/**
 * Instant "new website lead" alert to Yahoska — NEVER to the lead.
 *
 * Channels (each env-gated, run in parallel, short timeout, errors swallowed):
 *  1. Email via GHL Conversations API, addressed to Yahoska's own GHL contact
 *     (GHL_ALERT_CONTACT_ID, yperez@healthexps.com). Uses GHL_API_TOKEN.
 *     Fallback (only if GHL email fails and ALERT_SMTP_USER/PASS are set):
 *     SMTP to yperez@healthexps.com.
 *  2. Telegram DM via Igor's bot (TELEGRAM_BOT_TOKEN → TELEGRAM_YAHOSKA_CHAT_ID).
 *
 * Recipients are fixed server-side; nothing from the form can change them.
 */
const { answerLines } = require('./ghl-enrich');

const LOCATION_ID = process.env.GHL_LOCATION_ID || 'RINM4TCnM4hN06UA1aK0';
const ALERT_CONTACT_ID = process.env.GHL_ALERT_CONTACT_ID || 'CVRw8qHNJec4GhdFWpqh'; // Yahoska's own contact
const ALERT_EMAIL = 'yperez@healthexps.com';

function fmtEt(d) {
  try {
    return new Date(d).toLocaleString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) + ' ET';
  } catch (e) { return String(d); }
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
<p style="color:#888;font-size:12px">Automatic alert from the healthexps.com lead form. Nothing was sent to the lead.</p></div>`;
  return { subject, text, html, name };
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

async function sendTelegram(alert, ms) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_YAHOSKA_CHAT_ID;
  if (!token || !chatId) return 'skip:no_telegram';
  return withTimeout(async (signal) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: alert.text.slice(0, 4000), disable_web_page_preview: true }),
      signal,
    });
    if (!res.ok) throw new Error('telegram ' + res.status);
    return 'ok';
  }, ms);
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
  const tg = (async () => {
    try { out.telegram = await sendTelegram(alert, ms); } catch (e) { out.telegram = 'error:' + e.message; }
  })();
  await Promise.allSettled([email, tg]);
  return out;
}

module.exports = { sendLeadAlert, buildAlert, ALERT_CONTACT_ID };
