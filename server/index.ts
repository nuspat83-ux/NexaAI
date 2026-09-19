import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createProject, getProject, updateProject } from './store.js';
import { calculatePrice, itemizePrice } from './pricing.js';
import { generateWebsite, planDirectBrief } from './ai.js';
import { websiteHtml } from './render.js';
import { catalogModeForCategory } from '../src/catalog.js';
import { assertPaymentConfig, createRazorpayOrder, verifyCheckoutSignature } from './payment.js';

const dist = path.resolve('./dist');

export type BackgroundTaskScheduler = (task: Promise<unknown>) => void;

function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

const MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024;

class RequestTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the 4 MB application limit');
    this.name = 'RequestTooLargeError';
  }
}

class InvalidJsonError extends Error {
  constructor() {
    super('Request body must be valid JSON');
    this.name = 'InvalidJsonError';
  }
}

async function body(req: IncomingMessage) {
  let raw = '';
  for await (const chunk of req) {
    raw += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    if (Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BODY_BYTES) {
      throw new RequestTooLargeError();
    }
  }
  return raw;
}

async function jsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await body(req);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

function isValidGenerateState(value: unknown): value is Parameters<typeof generateWebsite>[0] {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  const arrays = ['styles', 'sections', 'pages', 'features', 'assets'];
  if (!arrays.every(key => Array.isArray(s[key]))) return false;
  const assets = s.assets as unknown[];
  if (typeof s.businessName !== 'string' || typeof s.customBusiness !== 'string') return false;
  if (!s.businessName.trim() && !s.customBusiness.trim()) return false;
  if (!assets.every((asset: unknown) => {
    if (!asset || typeof asset !== 'object') return false;
    const a = asset as Record<string, unknown>;
    return typeof a.name === 'string' && typeof a.type === 'string' && typeof a.url === 'string'
      && (a.data === undefined || typeof a.data === 'string');
  })) return false;
  if (!s.catalog || typeof s.catalog !== 'object') return false;
  const catalog = s.catalog as Record<string, unknown>;
  if (!['products','menu','services','none'].includes(String(catalog.mode))) return false;
  if (catalog.orderFlow !== undefined && !['none','whatsapp','cart','checkout'].includes(String(catalog.orderFlow))) return false;
  if (!Array.isArray(catalog.products) || !Array.isArray(catalog.services) || catalog.products.length > 100 || catalog.services.length > 100) return false;
  const products = catalog.products as unknown[];
  if (!products.every((product: unknown) => {
    if (!product || typeof product !== 'object') return false;
    const p = product as Record<string, unknown>;
    return typeof p.id === 'string' && typeof p.name === 'string' && p.name.length <= 300
      && (p.price === undefined || (typeof p.price === 'number' && Number.isFinite(p.price) && p.price >= 0))
      && (p.salePrice === undefined || (typeof p.salePrice === 'number' && Number.isFinite(p.salePrice) && p.salePrice >= 0))
      && (p.images === undefined || (Array.isArray(p.images) && p.images.length <= 8 && p.images.every((v: unknown) => typeof v === 'string')))
      && (p.variants === undefined || (Array.isArray(p.variants) && p.variants.length <= 20));
  })) return false;
  const services = catalog.services as unknown[];
  if (!services.every((service: unknown) => {
    if (!service || typeof service !== 'object') return false;
    const v = service as Record<string, unknown>;
    return typeof v.id === 'string' && typeof v.name === 'string' && v.name.length <= 300
      && (v.price === undefined || (typeof v.price === 'number' && Number.isFinite(v.price) && v.price >= 0));
  })) return false;
  if (catalog.mode !== 'none' && catalog.mode !== catalogModeForCategory(String(s.category || ''))) return false;
  return true;
}

function authToken(req: IncomingMessage) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function headers(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
}

function download(res: ServerResponse, html: string, name: string) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.end(html);
}

async function runGeneration(
  projectId: string,
  accessToken: string,
  state: Parameters<typeof generateWebsite>[0],
) {
  try {
    const spec = await generateWebsite(state, stage =>
      updateProject(projectId, accessToken, {
        status: 'GENERATING',
        generationStage: stage,
        generationError: undefined,
      }),
    );
    await updateProject(projectId, accessToken, {
      spec,
      status: 'PREVIEW_READY',
      generationStage: 'Preview ready',
      generationError: undefined,
    });
  } catch {
    await updateProject(projectId, accessToken, {
      status: 'DRAFT',
      generationError: 'We could not finish generating your website. Please retry.',
    });
  }
}

export async function requestHandler(
  req: IncomingMessage,
  res: ServerResponse,
  scheduleBackground: BackgroundTaskScheduler,
) {
  headers(res);

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        aiConfigured: Boolean(process.env.GEMINI_API_KEY),
        paymentsConfigured: Boolean(
          process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
        ),
        time: new Date().toISOString(),
      });
    }

    if (url.pathname === '/api/direct-plan' && req.method === 'POST') {
      if (!process.env.GEMINI_API_KEY) {
        return json(res, 503, { error: 'GEMINI_API_KEY is not configured on the server' });
      }
      const input = await jsonBody<{ brief?: string; clarification?: string }>(req);
      if (typeof input.brief !== 'string' || input.brief.trim().length < 12 || input.brief.length > 10000) {
        return json(res, 400, { error: 'A direct brief of at least 12 characters is required' });
      }
      const plan = await planDirectBrief(input.brief, typeof input.clarification === 'string' ? input.clarification : '');
      return json(res, 200, plan);
    }

    if (url.pathname === '/api/generate' && req.method === 'POST') {
      if (!process.env.GEMINI_API_KEY) {
        return json(res, 503, { error: 'GEMINI_API_KEY is not configured on the server' });
      }

      const state = await jsonBody<Parameters<typeof generateWebsite>[0]>(req);
      if (!isValidGenerateState(state)) {
        return json(res, 400, { error: 'Invalid builder configuration' });
      }

      const price = calculatePrice(state);
      const created = await createProject(state, price);
      await updateProject(created.project.id, created.accessToken, { status: 'CONFIGURED' });
      scheduleBackground(runGeneration(created.project.id, created.accessToken, state));

      return json(res, 202, {
        projectId: created.project.id,
        accessToken: created.accessToken,
        status: 'GENERATING',
        price,
      });
    }

    const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (match && req.method === 'GET') {
      const token = authToken(req);
      const p = await getProject(match[1], token);
      if (!p) return json(res, 401, { error: 'Unauthorized' });

      return json(res, 200, {
        id: p.id,
        status: p.status,
        price: p.price,
        spec: p.spec,
        pricing: itemizePrice(p.state),
        generationStage: p.generationStage,
        generationError: p.generationError,
      });
    }

    const approve = url.pathname.match(/^\/api\/projects\/([^/]+)\/approve$/);
    if (approve && req.method === 'POST') {
      const token = authToken(req);
      const p = await getProject(approve[1], token);
      if (!p) return json(res, 401, { error: 'Unauthorized' });
      if (p.status !== 'PREVIEW_READY') {
        return json(res, 409, { error: 'Project is not ready for approval' });
      }

      await updateProject(p.id, token, { status: 'PAYMENT_PENDING' });
      return json(res, 200, { status: 'PAYMENT_PENDING' });
    }

    if (url.pathname === '/api/payment/order' && req.method === 'POST') {
      const token = authToken(req);
      const { projectId } = await jsonBody<{ projectId?: string }>(req);
      if (!projectId) return json(res, 400, { error: 'projectId is required' });
      const p = await getProject(projectId, token);
      if (!p) return json(res, 401, { error: 'Unauthorized' });
      if (!['PREVIEW_READY', 'PAYMENT_PENDING'].includes(p.status)) {
        return json(res, 409, { error: 'Project is not payable' });
      }

      assertPaymentConfig({
        keyId: process.env.RAZORPAY_KEY_ID || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET || '',
      });

      const price = calculatePrice(p.state);
      const order = await createRazorpayOrder(price, projectId);
      await updateProject(projectId, token, {
        price,
        razorpayOrderId: order.id,
        status: 'PAYMENT_PENDING',
      });
      return json(res, 200, {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: price * 100,
        currency: 'INR',
        price,
      });
    }

    if (url.pathname === '/api/payment/verify' && req.method === 'POST') {
      const token = authToken(req);
      const input = await jsonBody<{ projectId?: string; orderId?: string; paymentId?: string; signature?: string; amount?: number }>(req);
      if (!input.projectId || !input.orderId || !input.paymentId || !input.signature || typeof input.amount !== 'number') {
        return json(res, 400, { error: 'projectId, orderId, paymentId, signature and numeric amount are required' });
      }
      const p = await getProject(input.projectId, token);
      if (!p) return json(res, 401, { error: 'Unauthorized' });

      assertPaymentConfig({
        keyId: process.env.RAZORPAY_KEY_ID || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET || '',
      });

      const expected = calculatePrice(p.state);
      if (!p.razorpayOrderId || input.orderId !== p.razorpayOrderId) {
        return json(res, 400, { error: 'Order mismatch' });
      }
      if (Number(input.amount) !== expected) {
        return json(res, 400, { error: 'Amount mismatch' });
      }
      if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature)) {
        return json(res, 400, { error: 'Payment signature verification failed' });
      }

      await updateProject(p.id, token, {
        status: 'UNLOCKED',
        razorpayPaymentId: input.paymentId,
        price: expected,
      });
      return json(res, 200, { status: 'UNLOCKED' });
    }

    const exp = url.pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
    if (exp && req.method === 'GET') {
      const token = authToken(req);
      const p = await getProject(exp[1], token);
      if (!p) return json(res, 401, { error: 'Unauthorized' });
      if (!['UNLOCKED', 'EXPORTED', 'DEPLOYED'].includes(p.status)) {
        return json(res, 402, { error: 'Payment required' });
      }
      if (!p.spec) return json(res, 404, { error: 'Generated site not found' });

      await updateProject(p.id, token, { status: 'EXPORTED' });
      return download(
        res,
        websiteHtml(p.spec),
        `${p.spec.business.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`,
      );
    }

    if (url.pathname.startsWith('/api/')) {
      return json(res, 404, { error: 'Not found' });
    }

    if (req.method !== 'GET') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const requested =
      path.normalize(url.pathname) === '/' ? '/index.html' : path.normalize(url.pathname);
    const target = path.resolve(dist, `.${requested}`);
    if (target !== dist && !target.startsWith(`${dist}${path.sep}`)) return json(res, 403, { error: 'Forbidden' });

    const data = await fs.readFile(target);
    const ext = path.extname(target);
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.webp': 'image/webp',
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.end(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    const status =
      error instanceof RequestTooLargeError
        ? 413
        : error instanceof InvalidJsonError
          ? 400
          : /configured|credentials|temporarily unavailable|rate limit|quota limit/i.test(message)
            ? 503
            : /Unauthorized/i.test(message)
              ? 401
              : 500;
    if (!res.headersSent) json(res, status, { error: message });
    else res.end();
  }
}
