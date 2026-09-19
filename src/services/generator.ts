import type { BuilderState, WebsiteSpec } from '../types';

export interface ProjectSession { projectId:string; accessToken:string; status:string; price:number; }
const SESSION_KEY='nexaai.project-session';
let current:ProjectSession|null=typeof window==='undefined'?null:loadSession();

function loadSession():ProjectSession|null{
  try{
    const raw=sessionStorage.getItem(SESSION_KEY);
    return raw?JSON.parse(raw) as ProjectSession:null;
  }catch{return null;}
}

function setSession(session:ProjectSession|null){
  current=session;
  try{
    if(session)sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }catch{}
}

export const getProjectSession=()=>current;

async function request<T>(path:string, init?:RequestInit):Promise<T>{const r=await fetch(path,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);return data as T;}

export async function generateWebsite(state:BuilderState,onProgress:(label:string)=>void):Promise<WebsiteSpec>{
  const stages=['Understanding your business','Planning your website','Creating your design','Writing your content','Building your pages','Adding your products','Optimizing for mobile','Running final checks','Preparing your preview'];
  onProgress(stages[0]);
  const started=await request<{projectId:string;accessToken:string;status:string;price:number;spec?:WebsiteSpec}>('/api/generate',{method:'POST',body:JSON.stringify(state)});
  setSession({...started});
  const session=getProjectSession();
  if(!session)throw new Error('Unable to initialize project session');
  if(started.status==='PREVIEW_READY'&&started.spec){
    setSession({...session,status:started.status,price:started.price});
    for(const stage of stages)onProgress(stage);
    return {...started.spec,assets:state.assets} as WebsiteSpec;
  }
  throw new Error('Generation did not return a preview. Please retry.');
}

export async function approveProject(){if(!current)throw new Error('No generated project');return request<{status:string}>(`/api/projects/${current.projectId}/approve`,{method:'POST',headers:{Authorization:`Bearer ${current.accessToken}`}});}
export async function createPaymentOrder(){if(!current)throw new Error('No generated project');return request<{keyId:string;orderId:string;amount:number;currency:string;price:number}>('/api/payment/order',{method:'POST',headers:{Authorization:`Bearer ${current.accessToken}`},body:JSON.stringify({projectId:current.projectId})});}
export async function verifyPayment(input:{orderId:string;paymentId:string;signature:string;amount:number}){if(!current)throw new Error('No generated project');const out=await request<{status:string}>('/api/payment/verify',{method:'POST',headers:{Authorization:`Bearer ${current.accessToken}`},body:JSON.stringify({...input,projectId:current.projectId})});setSession({...current,status:out.status});return out;}
export async function downloadExport(){if(!current)throw new Error('No generated project');const r=await fetch(`/api/projects/${current.projectId}/export`,{headers:{Authorization:`Bearer ${current.accessToken}`}});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'Export is locked');}const blob=await r.blob();return URL.createObjectURL(blob);}

export interface DirectPlan { category:string; businessName:string; description:string; location:string; phone:string; whatsapp:string; email:string; address:string; hours:string; socials:string; brief:string; audience:string; styles:string[]; pages:string[]; sections:string[]; features:string[]; catalogMode:'products'|'menu'|'services'|'none'; orderFlow:'none'|'whatsapp'|'cart'|'checkout'; products:Array<{id:string;name:string;description?:string;price?:number;salePrice?:number;currency?:string;category?:string;images?:string[];variants?:Array<{id:string;label:string;value:string}>;size?:string;color?:string;stock?:string;sku?:string;featured?:boolean;tags?:string[];customFields?:Record<string,string>}>; services:Array<{id:string;name:string;description?:string;price?:number;currency?:string;category?:string;image?:string;featured?:boolean;tags?:string[];customFields?:Record<string,string>}>; businessDetails:Record<string,string>; clarifyingQuestions:string[]; }
export async function planDirectBrief(brief:string, clarification=''):Promise<DirectPlan>{ return request<DirectPlan>('/api/direct-plan',{method:'POST',body:JSON.stringify({brief,clarification})}); }
