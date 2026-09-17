import { strict as assert } from 'node:assert';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';

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
    const { createProject, updateProject } = await import('../server/store.js');
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
        body: JSON.stringify({ businessName: 'Test Bakery', pages: ['Home'], features: [] }),
      });
      assert.equal(missingGemini.status, 503);
      assert.match(await missingGemini.text(), /GEMINI_API_KEY is not configured/);

      process.env.GEMINI_API_KEY = 'test-gemini-key';
      const websiteSpec = {
        business: 'Test Bakery',
        tagline: 'Fresh every day.',
        seo: { title: 'Test Bakery', description: 'Fresh bakery in Mumbai.' },
        colors: { primary: '#C9A46C', secondary: '#111318', background: '#FFFFFF', text: '#151515' },
        typography: { heading: 'Inter', body: 'Inter' },
        nav: ['Home'],
        hero: { eyebrow: 'Bakery', headline: 'Fresh every day.', body: 'Bakes made for your neighbourhood.', cta: 'Visit us' },
        sections: [],
        contact: { phone: '', whatsapp: '', email: 'hello@test-bakery.example', address: 'Mumbai', hours: 'Daily' },
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
        body: JSON.stringify({ businessName: 'Test Bakery', pages: ['Home', 'About', 'Contact', 'Gallery'], features: [] }),
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

      const paymentConfigMissing = await httpRequest(server, '/api/payment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${started.accessToken}` },
        body: JSON.stringify({ projectId: started.projectId }),
      });
      assert.equal(paymentConfigMissing.status, 503);
      assert.match(await paymentConfigMissing.text(), /Razorpay credentials are not configured/);

      await updateProject(started.projectId, started.accessToken, { status: 'UNLOCKED' });
      const unlockedExport = await httpRequest(server, `/api/projects/${started.projectId}/export`, {
        headers: { Authorization: `Bearer ${started.accessToken}` },
      });
      assert.equal(unlockedExport.status, 200);
      assert.equal(unlockedExport.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.match(await unlockedExport.text(), /Test Bakery/);

      const direct = await createProject({ businessName:'Direct Project', category:'Other', plan:'Starter', pages:['Home'], features:[], styles:[], assets:[], sections:[], customBusiness:'', tagline:'', description:'', location:'', phone:'', whatsapp:'', email:'', address:'', hours:'', socials:'', existingWebsite:'', brief:'', audience:'', primary:'#000000', secondary:'#111111', font:'Inter', theme:'ai' }, 4999);
      const verifyConfigMissing = await httpRequest(server, '/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${direct.accessToken}` },
        body: JSON.stringify({ projectId: direct.project.id, orderId: 'order_x', paymentId: 'pay_x', signature: 'sig_x', amount: 4999 }),
      });
      assert.equal(verifyConfigMissing.status, 503);
      assert.match(await verifyConfigMissing.text(), /Razorpay credentials are not configured/);
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
    functions:Record<string,{runtime:string;maxDuration:number}>;
  };
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.functions['api/[...path].ts'].runtime, 'nodejs22.x');
  assert.equal(config.functions['api/[...path].ts'].maxDuration, 300);
});
