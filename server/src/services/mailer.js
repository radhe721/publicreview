import { env } from '../config/env.js';

// Messages "sent" under NODE_ENV=test, so tests can read reset links without a mail provider.
export const testOutbox = [];

/**
 * Sends a transactional email through Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without a key, outside production the message is logged so the flow still works locally.
 */
export async function sendMail({ to, subject, text, html }) {
  if (env.NODE_ENV === 'test') {
    testOutbox.push({ to, subject, text, html });
    return;
  }

  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not set; cannot send email.');
    }
    console.log(`📧 [dev mail] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, html })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Email send failed (${res.status}): ${body.slice(0, 200)}`);
  }
}
