/**
 * send-email — LOCKED DOWN (Oct 2026).
 *
 * This used to send arbitrary HTML to any `to` address supplied by the browser,
 * guarded only by a spoofable Origin/Referer header (an open mail relay once
 * SMTP is configured). The life-insurance calculators (EN + ES) still call it
 * to "email my estimate", so it is kept but:
 *   - the recipient is FIXED server-side (internal inbox); the request's `to`
 *     is ignored and only recorded in the body as the visitor's address
 *   - the client HTML is escaped (no arbitrary HTML is relayed)
 *   - small payload limit
 * The visitor's lead (with email) is saved in GHL by submit-lead separately.
 * Requires SMTP_USER / SMTP_PASS in Netlify env; without them it returns 503.
 */
const INTERNAL_RECIPIENTS = ['yperez@healthexps.com'];
const MAX_BODY = 20000;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function stripTags(html) {
  return String(html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (String(event.body || '').length > MAX_BODY) {
    return { statusCode: 413, body: 'Payload too large' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const origin = event.headers.origin || event.headers.referer || '';
  const allowed = ['https://healthexps.com', 'https://www.healthexps.com'];
  if (!allowed.some((o) => origin.startsWith(o))) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'Email not configured' }) };
  }

  const visitor = String(data.to || '').slice(0, 200);
  const subject = '[Website calculator] ' + String(data.subject || 'Estimate request').replace(/[\r\n]+/g, ' ').slice(0, 150);
  const text = stripTags(data.html).slice(0, 8000);
  const html = `<p><b>Visitor email:</b> ${esc(visitor)}</p><p>A visitor asked the website calculator to email them this estimate. It was NOT sent to them automatically; reply from your own inbox if appropriate.</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${esc(text)}</pre>`;

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: '"The Health Experts Insurance" <info@healthexps.com>',
      to: INTERNAL_RECIPIENTS.join(','),
      subject,
      html,
    });
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('Send error:', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};

exports.INTERNAL_RECIPIENTS = INTERNAL_RECIPIENTS;
