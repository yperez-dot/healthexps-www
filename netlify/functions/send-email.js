const nodemailer = require('nodemailer');

const ALLOWED_ORIGINS = [
  'https://www.healthexps.com',
  'https://healthexps.com',
  'https://healthexps-en.netlify.app',
  'https://healthexps-es.netlify.app'
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // This function sends email from our own Gmail account on behalf of
  // whoever calls it — without an origin check, any site on the internet
  // could use it as a free, unauthenticated mail relay.
  const origin = event.headers.origin || event.headers.Origin || '';
  const originAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+--healthexps[a-z0-9-]*\.netlify\.app$/.test(origin);
  if (!originAllowed) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { to, subject, html } = data;
  if (!to || !html || !EMAIL_RE.test(to)) {
    return { statusCode: 400, body: 'Missing or invalid required fields' };
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP_USER / SMTP_PASS environment variables are not set in Netlify.');
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'Email sending is not configured (missing SMTP credentials).' })
    };
  }

  // Origin check — only allow requests from healthexps.com
  const origin = (event.headers.origin || event.headers.referer || '');
  const allowed = ['https://healthexps.com', 'https://www.healthexps.com'];
  if (!allowed.some(o => origin.startsWith(o))) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { statusCode: 500, body: 'Email not configured' };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: '"The Health Experts Insurance" <info@healthexps.com>',
      to,
      subject: subject || 'Your Life Insurance Estimate',
      html
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': origin },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('Send error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
