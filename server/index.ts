import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createProject, getProject, updateProject } from './store.js';
import { calculatePrice, itemizePrice } from './pricing.js';
import { generateWebsite } from './ai.js';
import { websiteHtml } from './render.js';
import { createRazorpayOrder, verifyCheckoutSignature } from './payment.js';

const port = Number(process.env.PORT || 8787);
const dist = path.resolve('./dist');
const json = (res:http.ServerResponse,status:number,data:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
async function body(req:http.IncomingMessage){let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>8_000_000)throw new Error('Request too large');return raw;}
function authToken(req:http.IncomingMessage){const value=req.headers.authorization||'';return value.startsWith('Bearer ')?value.slice(7):'';}
function secureHeaders(res:http.ServerResponse){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');}
function sendDownload(res:http.ServerResponse,html:string,name:string){res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${name}"`);res.end(html);}

const server=http.createServer(async(req,res)=>{
  secureHeaders(res);
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,aiConfigured:Boolean(process.env.GEMINI_API_KEY),paymentsConfigured:Boolean(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET),time:new Date().toISOString()});
    if(url.pathname==='/api/generate'&&req.method==='POST'){
      const state=JSON.parse(await body(req));
      if(!state.businessName&&!state.customBusiness)throw new Error('Business name or business description is required');
      const price=calculatePrice(state); const created=await createProject(state,price);
      await updateProject(created.project.id,created.accessToken,{status:'GENERATING'});
      let spec;
      try{spec=await generateWebsite(state,(stage)=>res.headersSent||stage);}
      catch(error){await updateProject(created.project.id,created.accessToken,{status:'DRAFT'});throw error;}
      await updateProject(created.project.id,created.accessToken,{spec,status:'PREVIEW_READY',price});
      return json(res,200,{projectId:created.project.id,accessToken:created.accessToken,status:'PREVIEW_READY',price,spec});
    }
    const match=url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if(match&&req.method==='GET'){
      const token=authToken(req);const p=await getProject(match[1],token);if(!p)return json(res,401,{error:'Unauthorized'});
      return json(res,200,{id:p.id,status:p.status,price:p.price,spec:p.spec,pricing:itemizePrice(p.state)});
    }
    if(url.pathname==='/api/payment/order'&&req.method==='POST'){
      const token=authToken(req);const {projectId}=JSON.parse(await body(req));const p=await getProject(projectId,token);if(!p)return json(res,401,{error:'Unauthorized'});
      const price=calculatePrice(p.state);const order=await createRazorpayOrder(price,projectId);await updateProject(projectId,token,{price,razorpayOrderId:order.id,status:'PAYMENT_PENDING'});return json(res,200,{keyId:process.env.RAZORPAY_KEY_ID,orderId:order.id,amount:price*100,currency:'INR',price});
    }
    if(url.pathname==='/api/payment/verify'&&req.method==='POST'){
      const token=authToken(req);const input=JSON.parse(await body(req));const p=await getProject(input.projectId,token);if(!p)return json(res,401,{error:'Unauthorized'});
      const expected=calculatePrice(p.state);if(input.amount && Number(input.amount)!==expected)return json(res,400,{error:'Amount mismatch'});
      if(!p.razorpayOrderId||input.orderId!==p.razorpayOrderId)return json(res,400,{error:'Order mismatch'});
      if(!verifyCheckoutSignature(input.orderId,input.paymentId,input.signature))return json(res,400,{error:'Payment signature verification failed'});
      await updateProject(p.id,token,{status:'UNLOCKED',razorpayPaymentId:input.paymentId,price:expected});return json(res,200,{status:'UNLOCKED'});
    }
    const exp=url.pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
    if(exp&&req.method==='GET'){
      const token=authToken(req);const p=await getProject(exp[1],token);if(!p)return json(res,401,{error:'Unauthorized'});if(!['UNLOCKED','EXPORTED','DEPLOYED'].includes(p.status))return json(res,402,{error:'Payment required'});if(!p.spec)return json(res,404,{error:'Generated site not found'});
      await updateProject(p.id,token,{status:'EXPORTED'});return sendDownload(res,websiteHtml(p.spec),`${p.spec.business.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.html`);
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    const requested=path.normalize(url.pathname)==='/'?'/index.html':path.normalize(url.pathname);const target=path.resolve(dist,`.${requested}`);if(!target.startsWith(dist))return json(res,403,{error:'Forbidden'});
    const data=await fs.readFile(target);const ext=path.extname(target);const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};res.statusCode=200;res.setHeader('Content-Type',types[ext]||'application/octet-stream');res.end(data);
  }catch(error){const message=error instanceof Error?error.message:'Request failed';const status=/configured|environment|credentials/i.test(message)?503:500;if(!res.headersSent)json(res,status,{error:message});else res.end();}
});
server.listen(port,()=>console.log(`NexaAI server listening on :${port}`));
void crypto;
