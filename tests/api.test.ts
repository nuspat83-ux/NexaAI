import { strict as assert } from 'node:assert';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';

const validState = {
  creationMode: 'guided' as const,
  directBrief: '',
  businessDetails: {},
  catalog: { mode: 'menu', products: [{ id: 'm1', name: 'Croissant', price: 180, category: 'Bakery', images: [] }], services: [], payment: 'whatsapp', delivery: { areas: 'Mumbai' } },
  category: 'Cafe',
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

      const missingDirectGemini = await httpRequest(server, '/api/direct-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: 'Build a premium clothing website in Mumbai.' }),
      });
      assert.equal(missingDirectGemini.status, 503);
      assert.match(await missingDirectGemini.text(), /GEMINI_API_KEY is not configured/);

      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const invalidDirect = await httpRequest(server, '/api/direct-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: 'too short' }),
      });
      assert.equal(invalidDirect.status, 400);
      assert.match(await invalidDirect.text(), /at least 12 characters/);

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
          const requestBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
          const prompt = requestBody?.contents?.[0]?.parts?.[0]?.text || '';
          const response = prompt.includes("website planning assistant")
            ? (prompt.includes('Additional clarification:') && !prompt.endsWith('none')
              ? { category:'E-commerce', businessName:'Mumbai Threads', description:'A clothing shop selling curated apparel.', location:'Mumbai', phone:'', whatsapp:'+91 9000000000', email:'', address:'', hours:'', socials:'', brief:'My clothing shop is in Mumbai and I want a premium product website.', audience:'Fashion shoppers', styles:['Premium','Modern'], pages:['Home','Products','About','Contact'], sections:['Hero','Products','Testimonials','Contact'], features:['Product catalog','WhatsApp button','SEO setup'], catalogMode:'products', orderFlow:'both', products:[{id:'p1',name:'Black Dress',price:1299,size:'S, M, L',color:'Black',images:['dress.jpg']}], services:[], businessDetails:{products:'40 products',productCategories:'Clothing',payment:'Both online payment and WhatsApp ordering'}, clarifyingQuestions:[] }
              : { category:'E-commerce', businessName:'Mumbai Threads', description:'A clothing shop selling curated apparel.', location:'Mumbai', phone:'', whatsapp:'+91 9000000000', email:'', address:'', hours:'', socials:'', brief:'My clothing shop is in Mumbai and I want a premium product website.', audience:'Fashion shoppers', styles:['Premium','Modern'], pages:['Home','Products','About','Contact'], sections:['Hero','Products','Testimonials','Contact'], features:['Product catalog','WhatsApp button','SEO setup'], catalogMode:'products', products:[{id:'p1',name:'Black Dress',price:1299,size:'S, M, L',color:'Black',images:['dress.jpg']}], services:[], businessDetails:{products:'40 products',productCategories:'Clothing'}, clarifyingQuestions:['Do you want customers to pay online, order on WhatsApp, or use both?'] })
            : websiteSpec;
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input, init);
      };

      const directPlan = await httpRequest(server, '/api/direct-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: 'My clothing shop is in Mumbai and I want a premium product website.' }),
      });
      assert.equal(directPlan.status, 200);
      const directBody = await directPlan.json() as Record<string, any>;
      assert.equal(directBody.category, 'E-commerce');
      assert.equal(directBody.businessName, 'Mumbai Threads');
      assert.ok(Array.isArray(directBody.features));
      assert.equal(directBody.businessDetails.products, '40 products');
      assert.equal(directBody.catalogMode, 'products');
      assert.equal(directBody.orderFlow, 'both');
      assert.equal(directBody.products[0].price, 1299);
      assert.equal(directBody.products[0].size, 'S, M, L');
      assert.equal(directBody.products[0].color, 'Black');
      assert.equal(directBody.products[0].salePrice, undefined);
      assert.deepEqual(directBody.clarifyingQuestions, ['Do you want customers to pay online, order on WhatsApp, or use both?']);

      const clarificationPlan = await httpRequest(server, '/api/direct-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: 'My clothing shop is in Mumbai and I want a premium product website.',
          clarification: 'Both online payment and WhatsApp ordering.',
        }),
      });
      assert.equal(clarificationPlan.status, 200);
      const clarificationBody = await clarificationPlan.json() as Record<string, any>;
      assert.deepEqual(clarificationBody.clarifyingQuestions, []);
      assert.equal(clarificationBody.businessDetails.payment, 'Both online payment and WhatsApp ordering');
      assert.equal(clarificationBody.products[0].price, 1299);

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
      assert.deepEqual(ready.spec.products?.[0]?.name, 'Croissant');
      assert.equal(ready.spec.products?.[0]?.price, 180);
      assert.equal(ready.generationStage, 'Preview ready');

      const generatedPreview = ready.spec as Record<string, unknown>;
      const previewHtml = (await import('../server/render.js')).websiteHtml(generatedPreview as any);
      assert.match(previewHtml, /<main id="main">/);

      const catalogPreviewHtml = (await import('../server/render.js')).websiteHtml({business:'Catalog Site',tagline:'Shop',catalogMode:'products',products:[{id:'p1',name:'Black Dress',price:1299,images:['dress.jpg'],size:'S, M, L'}],services:[],sections:[],content:'Catalog',imageRequirements:[],cta:'Order',responsive:'Responsive',colors:{primary:'#111',secondary:'#222'},assets:[{name:'dress.jpg',type:'image/jpeg',url:'data:image/jpeg;base64,abc'}] } as any);
      assert.match(catalogPreviewHtml, /Black Dress/);
      assert.match(catalogPreviewHtml, /1,299/);

      const minimalPreviewHtml = (await import('../server/render.js')).websiteHtml({
        business: 'Minimal Site',
        sections: [],
        content: 'Simple content',
        imageRequirements: [],
        cta: 'Contact',
        responsive: 'Responsive',
        colors: { primary: '#111', secondary: '#222' },
      } as any);
      assert.match(minimalPreviewHtml, /<main id="main">/);
      assert.match(minimalPreviewHtml, /Minimal Site/);

      const servicePreviewHtml = (await import('../server/render.js')).websiteHtml({business:'Service Site',catalogMode:'services',services:[{id:'s1',name:'Consultation',price:999}],products:[],sections:[],content:'Services',imageRequirements:[],cta:'Book',responsive:'Responsive',colors:{primary:'#111',secondary:'#222'}} as any);
      assert.match(servicePreviewHtml, /Consultation/);
      assert.match(servicePreviewHtml, /999/);

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
