# kilserv/portfolio

> Official security research portfolio and advisory disclosure platform for **Kilserv**.

\\\	ext
[ SYSTEM STATUS ]
> Architecture: Static (Hybrid)
> Framework:    Astro v5
> Deployment:   Vercel Edge
> Security:     Hardenized (CSP, HSTS, Permissions-Policy)
\\\

## // ARCHITECTURE

This project is built with a **security-first** approach, minimizing client-side JavaScript and enforcing strict content security policies.

* **Core:** Astro (TypeScript)
* **Styling:** CSS Modules (No frameworks, Zero-Runtime)
* **Content:** Markdown / Content Collections
* **Forms:** Vercel Serverless Functions + Resend API

## // INSTALLATION

\\\ash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/kilserv-portfolio.git

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# (Add RESEND_API_KEY and PUBLIC_CONTACT_EMAIL)

# 4. Initiate development server
npm run dev
\\\

## // SECURITY HEADERS

This portfolio implements strict HTTP headers via \ercel.json\:

* \Content-Security-Policy\: Strict \self\ only.
* \X-HackerOne-Research\: Kilserv (Bug Bounty Verification).
* \Permissions-Policy\: Camera, Mic, Geolocation disabled.
* \Referrer-Policy\: Strict-origin-when-cross-origin.

## // DEPLOYMENT

Push to **main** triggers a Vercel deployment.

> **Note:** The Contact Form requires the \output: 'hybrid'\ adapter configuration to function on Vercel.

---

© 2026 Kilserv. All systems normal.
