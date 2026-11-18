const nodemailer = require('nodemailer');

let transporter = null;

function isConfigured() {
  return Boolean(
    process.env.GMAIL_USER &&
    process.env.GMAIL_APP_PASSWORD &&
    process.env.EMAIL_FROM
  );
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return 'Not specified';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB', {
    timeZone: 'Africa/Accra',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function sendPickupCompletedEmail(details) {
  const to = String(details.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, skipped: true, reason: 'invalid_recipient' };
  }

  const transport = getTransporter();
  if (!transport) {
    return { ok: false, skipped: true, reason: 'missing_configuration' };
  }

  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://greenloop-vercel.vercel.app';
  const reference = String(details.reference_code || '');
  const name = String(details.customer_name || 'there');
  const subject = `Your GreenLoop pickup ${reference} is complete`;

  const text = [
    `Hi ${name},`,
    '',
    `Great news - your GreenLoop pickup ${reference} has been completed.`,
    '',
    'Collection details:',
    `- Waste category: ${details.waste_category || 'Not specified'}`,
    `- Pickup location: ${details.address || 'Not specified'}`,
    `- Preferred date: ${formatDate(details.preferred_date)}`,
    `- Vehicle: ${details.registration_number || 'Not specified'}`,
    `- Completed: ${formatDate(details.completed_at)}`,
    '',
    `You can check the status any time here: ${siteUrl}/track.php`,
    '',
    'Thank you for choosing GreenLoop.',
    'The GreenLoop Team'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#173a2a;line-height:1.6;max-width:600px">
      <h2 style="margin:0 0 16px;color:#1b5e3a">Pickup completed</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Great news - your GreenLoop pickup <strong>${escapeHtml(reference)}</strong> has been completed.</p>
      <div style="background:#f3f8f4;border:1px solid #d8e8dc;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:0 0 8px"><strong>Collection details</strong></p>
        <p style="margin:4px 0">Waste category: ${escapeHtml(details.waste_category || 'Not specified')}</p>
        <p style="margin:4px 0">Pickup location: ${escapeHtml(details.address || 'Not specified')}</p>
        <p style="margin:4px 0">Preferred date: ${escapeHtml(formatDate(details.preferred_date))}</p>
        <p style="margin:4px 0">Vehicle: ${escapeHtml(details.registration_number || 'Not specified')}</p>
        <p style="margin:4px 0">Completed: ${escapeHtml(formatDate(details.completed_at))}</p>
      </div>
      <p>You can check the status any time at <a href="${escapeHtml(siteUrl)}/track.php">${escapeHtml(siteUrl)}/track.php</a>.</p>
      <p>Thank you for choosing GreenLoop.<br>The GreenLoop Team</p>
    </div>`;

  try {
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html
    });
    return { ok: true, skipped: false, messageId: info.messageId };
  } catch (err) {
    console.error('Pickup completion email failed:', err.message);
    return { ok: false, skipped: false, reason: err.message };
  }
}

module.exports = { isConfigured, sendPickupCompletedEmail };
