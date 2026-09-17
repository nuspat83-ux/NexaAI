# NexaAI

NexaAI is a premium AI-assisted website creation platform. Customers configure a business, brand direction, structure, pages, features and reference assets, then generate a structured website specification and responsive preview.

## Local development

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Run the backend separately for local API development:

```bash
npm run dev:server
```

Production build:

```bash
npm run build
npm run preview
```

## Vercel deployment

The Vite frontend builds to `dist`. The production API is exposed through `api/[...path].ts`, which delegates all `/api/*` requests to the shared `server/index.ts` request handler. Vercel uses `waitUntil` from `@vercel/functions` for the existing asynchronous generation job so the request is not dependent on a detached post-response task.

`server/index.ts` no longer starts an HTTP listener when imported by Vercel. Local Node development uses `server/local.ts` instead.

## Environment

Copy `.env.example` to `.env` for deployment configuration. Never commit real secrets. AI provider keys and Razorpay secrets belong only on the server. `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are never part of the browser bundle.

## AI architecture

`Builder state -> Website Specification -> Generator -> Quality validation -> Preview`.
The real Gemini generation pipeline runs in `server/ai.ts` when `GEMINI_API_KEY` is configured. Missing Gemini configuration is reported as HTTP 503 rather than being mistaken for a missing route.

## Payments

The preview is available before payment. Export/deployment remains locked until the server verifies the Razorpay payment signature and changes the authoritative project status to `UNLOCKED`. Missing Razorpay configuration is reported as HTTP 503.

## Storage limitation on Vercel

`server/store.ts` intentionally remains behind the existing store abstraction and uses JSON-file persistence for now. On Vercel, the default data directory is `/tmp/nexaai-data`, which is writable but ephemeral and not shared as durable production storage across function instances. This is not production-grade persistence. A real database or managed KV/database store must replace the JSON file before relying on cross-instance durability.

## Leads

Existing Google Apps Script lead capture is preserved in `src/services/leads.ts`, with WhatsApp fallback URL generation. The lead payload includes ID, client, business, contact, website, requested service, budget, timeline, details, source and timestamp fields.

## Security notes

- No API or payment secret is stored in frontend source.
- Generated text is escaped when converted to downloadable HTML.
- User uploads are previewed as local object URLs and are not executed as scripts.
- Payment unlock is intentionally a server-side boundary, not a frontend success flag.
- Production should still add authenticated API routes, durable database persistence, rate limiting, CSRF/origin controls where applicable, content moderation and signed export URLs.

## Current customer flow

Landing -> 10-step builder -> staged generation -> responsive preview -> pricing -> payment-ready lock -> export boundary.

Pricing starts at **₹4,999**, with transparent extra-page and feature calculations in the builder.
