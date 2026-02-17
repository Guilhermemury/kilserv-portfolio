export const prerender = false; // Required for Vercel Serverless

import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const contactEmail = import.meta.env.PUBLIC_CONTACT_EMAIL;

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const email = data.get('email');
  const message = data.get('message');

  // Validate environment variables
  if (!contactEmail || !import.meta.env.RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ message: 'Server configuration error: Missing env vars' }),
      { status: 500 }
    );
  }

  // Validate form data
  if (!email || !message) {
    return new Response(
      JSON.stringify({ message: 'Missing required fields' }),
      { status: 400 }
    );
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: [contactEmail],
      replyTo: email as string,
      subject: `[Portfolio Inquiry] from ${email}`,
      html: `
        <h3>New Contact from Kilserv Portfolio</h3>
        <p><strong>Sender:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left: 4px solid #333; padding-left: 1rem; color: #555;">
          ${message}
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