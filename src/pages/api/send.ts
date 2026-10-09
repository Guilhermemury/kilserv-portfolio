export const prerender = false;
import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const contactEmail = import.meta.env.PUBLIC_CONTACT_EMAIL;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const RATE_LIMIT_WINDOW = 60_000;
const MAX_REQUESTS = 3;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  requestLog.set(ip, recent);
  if (recent.length >= MAX_REQUESTS) return true;
  recent.push(now);
  return false;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (isRateLimited(clientAddress)) {
    return new Response(
      JSON.stringify({ message: 'Too many requests. Try again later.' }),
      { status: 429 }
    );
  }

  const data = await request.formData();
  const email = data.get('email');
  const message = data.get('message');

  if (!contactEmail || !import.meta.env.RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ message: 'Server configuration error: Missing env vars' }),
      { status: 500 }
    );
  }

  if (!email || !message) {
    return new Response(
      JSON.stringify({ message: 'Missing required fields' }),
      { status: 400 }
    );
  }

  try {
    const safeEmail = escapeHtml(String(email));
    const safeMessage = escapeHtml(String(message));

    const { error } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: [contactEmail],
      replyTo: String(email),
      subject: `[Portfolio Inquiry] from ${safeEmail}`,
      html: `
        <h3>New Contact from Kilserv Portfolio</h3>
        <p><strong>Sender:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left: 4px solid #333; padding-left: 1rem; color: #555;">
          ${safeMessage}
        </blockquote>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      return new Response(JSON.stringify({ error }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ message: 'Email sent successfully' }),
      { status: 200 }
    );
  } catch (e) {
    console.error('Server Error:', e);
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      { status: 500 }
    );
  }
};
