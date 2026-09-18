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

`server/store.ts` intentionally remains behind the existing store abstraction and uses JSON-file persistence for now. On Vercel, the default data directory is `/tmp/nexaai-data`, which is writable but ephemeral and not shared as durable production storage across function instances. This is not production-grade persistence. A real database or managed KV/database store must replace the JSON file before relying on cross-instance durability. The current asynchronous generation path uses Vercel `waitUntil`; that keeps the task inside the Function lifecycle, but it does not make the JSON store durable or guarantee that later polling requests land on the same instance.

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

Pricing starts at **₹4,999**, with transparent extra-page and feature calculations in the builder. API request bodies are intentionally capped below Vercel's 4.5 MB Function payload limit; browser image uploads are compressed before generation so the builder can send references without exceeding that platform boundary.

## Day 1 creation architecture

NexaAI now supports two entry modes without replacing the existing generation/payment architecture:

- Guided Build keeps the 10-step customer-controlled builder and adapts recommended pages, sections, features, and business questions from a centralized business profile schema.
- NexaAI Direct accepts a natural-language website brief, sends it to the existing server-side Gemini boundary for structured planning, asks only for essential clarification when needed, then maps the plan back into the same BuilderState and existing /api/generate pipeline.

Business-aware configuration lives in src/businessProfiles.ts, so additional business types and Day 2/3 modules can be added without scattering category-specific logic through the UI. The Direct planner is exposed at POST /api/direct-plan; it does not unlock, bypass, or replace the existing payment/export security boundary.


## Day 3 catalog foundation

The builder now carries a business-aware catalog alongside the existing BuilderState. E-commerce uses structured products with optional pricing, variants, stock, SKU, tags and asset references; restaurants/cafes use menu items; service businesses use structured services. Direct planning can extract supplied catalog data without inventing missing values. Catalog payment, order-flow and delivery requirements remain descriptive foundations only; third-party checkout and delivery integrations are not introduced in Day 3.
