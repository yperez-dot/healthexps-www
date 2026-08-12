const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { to, subject, html } = data;
  if (!to || !html) {
    return { statusCode: 400, body: 'Missing required fields' };
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
      headers: { 'Access-Control-Allow-Origin': '*' },
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
