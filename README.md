# NexaAI

NexaAI is a premium AI-assisted website creation platform. Customers configure a business, brand direction, structure, pages, features and reference assets, then generate a structured website specification and responsive preview.

## Local development

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Type check / lint:

```bash
npm run lint
```

## Environment

Copy `.env.example` to `.env` for deployment configuration. Never commit real secrets. AI provider keys and Razorpay secrets belong only on the server.

## AI architecture

`Builder state -> Website Specification -> Generator -> Quality validation -> Preview`.
`src/services/generator.ts` is intentionally provider-neutral so Gemini, OpenAI or another supported provider can be wired behind a server API later. The browser does not receive provider credentials.

## Payments

The preview is available before payment. Export/deployment must be protected by a backend payment state. `server/payment.ts` contains the Razorpay HMAC verification boundary and export policy. A production deployment should create orders server-side, verify webhook/signature data server-side, persist the paid state, then issue a short-lived export authorization.

## Leads

Existing Google Apps Script lead capture is preserved in `src/services/leads.ts`, with WhatsApp fallback URL generation. The lead payload includes ID, client, business, contact, website, requested service, budget, timeline, details, source and timestamp fields.

## Project management

`server/projects.ts` defines the persistence and authentication contracts for projects and status transitions. Connect these contracts to a real database and identity provider before exposing an internal operations console. No insecure frontend-only admin password is included.

## Security notes

- No API or payment secret is stored in frontend source.
- Generated text is escaped when converted to downloadable HTML.
- User uploads are previewed as local object URLs and are not executed as scripts.
- Payment unlock is intentionally a server-side boundary, not a frontend success flag.
- Production should add authenticated API routes, database persistence, rate limiting, CSRF/origin controls where applicable, content moderation and signed export URLs.

## Current customer flow

Landing -> 10-step builder -> staged generation -> responsive preview -> pricing -> payment-ready lock -> export boundary.

Pricing starts at **₹4,999**, with transparent extra-page and feature calculations in the builder.
