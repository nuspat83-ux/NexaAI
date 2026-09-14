import crypto from 'node:crypto';

export interface PaymentConfig { keyId:string; keySecret:string; webhookSecret:string; }
export interface PaymentOrder { id:string; amount:number; currency:string; status:'created'|'paid'|'failed'; projectId:string; }

export function assertPaymentConfig(config:PaymentConfig){
  for(const [name,value] of Object.entries(config)) if(!value) throw new Error(`Missing server payment configuration: ${name}`);
}

/** Server-side webhook verification. Call this from a private API/serverless route, never from the browser. */
export function verifyRazorpayWebhook(rawBody:string, signature:string, secret:string){
  const expected=crypto.createHmac('sha256',secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}

/** Export/unlock policy: the backend must persist payment status and issue an export token only after verification. */
export function canExport(status:string){ return status==='Paid'||status==='Unlocked'||status==='Delivered'; }
