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
  const started=await request<{projectId:string;accessToken:string;status:string;price:number}>('/api/generate',{method:'POST',body:JSON.stringify(state)});
  setSession({...started});
  const stages=['Analyzing requirements','Planning website','Creating design system','Writing business content','Processing images','Building pages','Optimizing responsive layout','Running quality checks','Preparing preview'];
  let seen='';
  for(let i=0;i<600;i++){
    const p=await request<any>(`/api/projects/${encodeURIComponent(current.projectId)}`,{headers:{Authorization:`Bearer ${current.accessToken}`} } );
    if(p.generationStage&&p.generationStage!==seen){seen=p.generationStage;onProgress(seen);}
    if(p.status==='PREVIEW_READY'&&p.spec){setSession({...current!,status:p.status,price:p.price});return p.spec as WebsiteSpec;}
    if(p.generationError)throw new Error(p.generationError);
    if(p.status==='DRAFT'&&i>2)throw new Error('Generation failed before preview was prepared');
    if(!seen&&i===0)onProgress(stages[0]);
    await new Promise(r=>setTimeout(r,1000));
  }
  throw new Error('Generation timed out. Please retry.');
}

export async function approveProject(){if(!current)throw new Error('No generated project');return request<{status:string}>(`/api/projects/${current.projectId}/approve`,{method:'POST',headers:{Authorization:`Bearer ${current.accessToken}`}});}
export async function createPaymentOrder(){if(!current)throw new Error('No generated project');return request<{keyId:string;orderId:string;amount:number;currency:string;price:number}>('/api/payment/order',{method:'POST',headers:{Authorization:`Bearer ${current.accessToken}`},body:JSON.stringify({projectId:current.projectId})});}
export async function verifyPayment(input:{orderId:string;paymentId:string;signature:string;amount:number}){if(!current)throw new Error('No generated project');const out=await request<{status:string}>('/api/payment/verify',{method:'POST',headers:{Authorization:`Bearer ${current.accessToken}`},body:JSON.stringify({...input,projectId:current.projectId})});setSession({...current,status:out.status});return out;}
export async function downloadExport(){if(!current)throw new Error('No generated project');const r=await fetch(`/api/projects/${current.projectId}/export`,{headers:{Authorization:`Bearer ${current.accessToken}`}});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'Export is locked');}const blob=await r.blob();return URL.createObjectURL(blob);}
