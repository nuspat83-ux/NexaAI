import crypto from 'node:crypto';

export interface PaymentConfig { keyId:string; keySecret:string; webhookSecret?:string; }
export interface PaymentOrder { id:string; amount:number; currency:string; status:string; projectId:string; }

export function assertPaymentConfig(config:PaymentConfig){
  if(!config.keyId||!config.keySecret) throw new Error('Razorpay credentials are not configured on the server');
}

function secret(){
  const keyId=process.env.RAZORPAY_KEY_ID||''; const keySecret=process.env.RAZORPAY_KEY_SECRET||'';
  assertPaymentConfig({keyId,keySecret}); return {keyId,keySecret};
}

export async function createRazorpayOrder(amountRupees:number, projectId:string):Promise<PaymentOrder>{
  const {keyId,keySecret}=secret();
  const response=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,'Content-Type':'application/json'},body:JSON.stringify({amount:Math.round(amountRupees*100),currency:'INR',receipt:`nexa_${projectId.slice(0,24)}`,notes:{projectId}})});
  if(!response.ok) throw new Error(`Razorpay order creation failed (${response.status})`);
  const payload:any=await response.json();
  if(!payload?.id) throw new Error('Razorpay returned an invalid order');
  return {id:payload.id,amount:payload.amount,currency:payload.currency,status:'created',projectId};
}

export function verifyCheckoutSignature(orderId:string,paymentId:string,signature:string){
  const keySecret=process.env.RAZORPAY_KEY_SECRET||''; if(!keySecret||!orderId||!paymentId||!signature)return false;
  const expected=crypto.createHmac('sha256',keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a=Buffer.from(expected,'utf8'); const b=Buffer.from(signature,'utf8'); return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

export function verifyRazorpayWebhook(rawBody:string,signature:string,secret=process.env.RAZORPAY_WEBHOOK_SECRET||''){
  if(!secret||!signature)return false; const expected=crypto.createHmac('sha256',secret).update(rawBody).digest('hex');
  const a=Buffer.from(expected,'utf8'); const b=Buffer.from(signature,'utf8'); return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

export function canExport(status:string){ return status==='UNLOCKED'||status==='EXPORTED'||status==='DEPLOYED'; }
