import { strict as assert } from 'node:assert';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';

const validState = {
  category: 'Bakery',
  customBusiness: '',
  businessName: 'Test Bakery',
  tagline: 'Fresh every day.',
  description: 'Neighbourhood bakery with fresh bakes.',
  location: 'Mumbai',
  phone: '+91 9000000000',
  whatsapp: '+91 9000000000',
  email: 'hello@test-bakery.example',
  address: 'Mumbai, Maharashtra',
  hours: 'Daily',
  socials: '@testbakery',
  existingWebsite: '',
  styles: ['Premium', 'Modern'],
  primary: '#C9A46C',
  secondary: '#111318',
  font: 'Inter',
  theme: 'ai' as const,
  sections: ['Hero', 'About', 'Services', 'Contact'],
  pages: ['Home', 'About', 'Contact', 'Gallery'],
  features: ['WhatsApp button', 'Contact form', 'SEO setup', 'Analytics-ready'],
  assets: [],
  brief: 'Keep the site warm, premium and specific to the bakery.',
  audience: 'Local bakery customers',
  plan: 'Starter',
};

async function httpRequest(server: Server, path: string, init: RequestInit = {}) {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server is not listening');
  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

test('Vercel-compatible API handler covers routing, auth, generation, payment config and export lock', async () => {
  const originalEnv = {
    dataDir: process.env.NEXAAI_DATA_DIR,
    gemini: process.env.GEMINI_API_KEY,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpaySecret: process.env.RAZORPAY_KEY_SECRET,
  };
  const originalFetch = globalThis.fetch;
  const dataDir = await mkdtemp(join(tmpdir(), 'nexaai-api-'));
  process.env.NEXAAI_DATA_DIR = dataDir;
  delete process.env.GEMINI_API_KEY;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;

  try {
    const { requestHandler } = await import('../server/index.js');
    const { updateProject } = await import('../server/store.js');
    const server = createServer((req, res) => {
      void requestHandler(req, res, task => {
        void task;
      });
    });
    server.listen(0);
    await once(server, 'listening');

    try {
      const health = await httpRequest(server, '/api/health');
      assert.equal(health.status, 200);
      const healthBody = await health.json() as Record<string, unknown>;
      assert.equal(healthBody.ok, true);
      assert.equal(healthBody.aiConfigured, false);
      assert.equal(healthBody.paymentsConfigured, false);
      assert.equal(typeof healthBody.time, 'string');

      const unknown = await httpRequest(server, '/api/no-such-route');
      assert.equal(unknown.status, 404);

      const missingGemini = await httpRequest(server, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validState),
      });
      assert.equal(missingGemini.status, 503);
      assert.match(await missingGemini.text(), /GEMINI_API_KEY is not configured/);

      process.env.GEMINI_API_KEY = 'test-gemini-key';
      const malformed = await httpRequest(server, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      });
      assert.equal(malformed.status, 400);

      const oversized = await httpRequest(server, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validState, brief: 'x'.repeat(4_200_000) }),
      });
      assert.equal(oversized.status, 413);


      const invalidShape = await httpRequest(server, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: 'Bad Shape', styles: 'not-an-array' }),
      });
      assert.equal(invalidShape.status, 400);
      assert.match(await invalidShape.text(), /Invalid builder configuration/);


      const websiteSpec = {
        business: 'Test Bakery',
        tagline: 'Fresh every day.',
        seo: { title: 'Test Bakery', description: 'Fresh bakery in Mumbai.' },
        colors: { primary: '#C9A46C', secondary: '#111318', background: '#FFFFFF', text: '#151515' },
        typography: { heading: 'Inter', body: 'Inter' },
        nav: ['Home'],
        hero: { eyebrow: 'Bakery', headline: 'Fresh every day.', body: 'Bakes made for your neighbourhood.', cta: 'Visit us' },
        sections: [],
        contact: { phone: '+91 9000000000', whatsapp: '+91 9000000000', email: 'hello@test-bakery.example', address: 'Mumbai', hours: 'Daily' },
        footer: 'Test Bakery',
      };
      globalThis.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('generativelanguage.googleapis.com')) {
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(websiteSpec) }] } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input, init);
      };

      const generate = await httpRequest(server, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validState),
      });
      assert.equal(generate.status, 202);
      const started = await generate.json() as { projectId:string; accessToken:string; price:number; status:string };
      assert.equal(started.status, 'GENERATING');
      assert.equal(started.price, 4999);

      const wrongToken = await httpRequest(server, `/api/projects/${encodeURIComponent(started.projectId)}`, {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      assert.equal(wrongToken.status, 401);

      let ready: any = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const response = await httpRequest(server, `/api/projects/${encodeURIComponent(started.projectId)}`, {
          headers: { Authorization: `Bearer ${started.accessToken}` },
        });
        assert.equal(response.status, 200);
        ready = await response.json();
        if (ready.status === 'PREVIEW_READY') break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.equal(ready.status, 'PREVIEW_READY');
      assert.equal(ready.spec.business, 'Test Bakery');
      assert.equal(ready.generationStage, 'Preview ready');

      const generatedPreview = ready.spec as Record<string, unknown>;
      const previewHtml = (await import('../server/render.js')).websiteHtml(generatedPreview as any);
      assert.match(previewHtml, /<main id="main">/);

      const lockedExport = await httpRequest(server, `/api/projects/${started.projectId}/export`, {
        headers: { Authorization: `Bearer ${started.accessToken}` },
      });
      assert.equal(lockedExport.status, 402);

      const approve = await httpRequest(server, `/api/projects/${started.projectId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${started.accessToken}` },
      });
      assert.equal(approve.status, 200);
      assert.deepEqual(await approve.json(), { status: 'PAYMENT_PENDING' });

      const paymentOrderMissing = await httpRequest(server, '/api/payment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${started.accessToken}` },
        body: JSON.stringify({ projectId: started.projectId }),
      });
      assert.equal(paymentOrderMissing.status, 503);
      assert.match(await paymentOrderMissing.text(), /Razorpay credentials are not configured/);

      const paymentVerifyMissing = await httpRequest(server, '/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${started.accessToken}` },
        body: JSON.stringify({ projectId: started.projectId, orderId: 'order_x', paymentId: 'pay_x', signature: 'sig_x', amount: 4999 }),
      });
      assert.equal(paymentVerifyMissing.status, 503);
      assert.match(await paymentVerifyMissing.text(), /Razorpay credentials are not configured/);

      process.env.RAZORPAY_KEY_ID = 'rzp_test';
      process.env.RAZORPAY_KEY_SECRET = 'razorpay-test-secret';
      const crypto = await import('node:crypto');
      const paymentId = 'pay_test_456';
      const orderId = 'order_test_123';
      await updateProject(started.projectId, started.accessToken, { status: 'PAYMENT_PENDING', razorpayOrderId: orderId });
      const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
      const verify = await httpRequest(server, '/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${started.accessToken}` },
        body: JSON.stringify({ projectId: started.projectId, orderId, paymentId, signature, amount: 4999 }),
      });
      assert.equal(verify.status, 200);
      assert.deepEqual(await verify.json(), { status: 'UNLOCKED' });

      const unlockedExport = await httpRequest(server, `/api/projects/${started.projectId}/export`, {
        headers: { Authorization: `Bearer ${started.accessToken}` },
      });
      assert.equal(unlockedExport.status, 200);
      assert.equal(unlockedExport.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.match(await unlockedExport.text(), /Test Bakery/);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.dataDir === undefined) delete process.env.NEXAAI_DATA_DIR; else process.env.NEXAAI_DATA_DIR = originalEnv.dataDir;
    if (originalEnv.gemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalEnv.gemini;
    if (originalEnv.razorpayKeyId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = originalEnv.razorpayKeyId;
    if (originalEnv.razorpaySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = originalEnv.razorpaySecret;
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('Vercel function and build configuration expose the API boundary', async () => {
  const apiSource = await readFile(new URL('../api/[...path].ts', import.meta.url), 'utf8');
  assert.match(apiSource, /waitUntil/);
  assert.match(apiSource, /requestHandler/);

  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    buildCommand:string;
    outputDirectory:string;
    functions:Record<string,{maxDuration:number}>;
  };
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.functions['api/**/*.ts'].maxDuration, 300);
});
