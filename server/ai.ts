import { randomUUID } from 'node:crypto';
import type {BuilderState,WebsiteSpec} from './types.js';
import type {Product,ServiceItem} from '../src/catalog.js';
const MAX_RETRIES=2,TIMEOUT_MS=90000;
function promptFor(s:BuilderState){return `You are NexaAI, a senior web designer, UX writer and information architect. Generate a complete business-specific website specification as strict JSON only.\nBusiness: ${s.businessName||s.customBusiness||s.category}. Tagline: ${s.tagline}. Description: ${s.description}. Location: ${s.location}. Phone: ${s.phone}. WhatsApp: ${s.whatsapp}. Email: ${s.email}. Address: ${s.address}. Hours: ${s.hours}. Socials: ${s.socials}.\nVisual direction: ${s.styles.join(', ')}; theme ${s.theme}; colors ${s.primary}/${s.secondary}; font ${s.font}.\nCatalog mode: ${s.catalog?.mode||'none'}. Structured products: ${JSON.stringify(s.catalog?.products||[])}. Structured services: ${JSON.stringify(s.catalog?.services||[])}. Payment requirement: ${s.catalog?.payment||'unknown'}. Order flow: ${s.catalog?.orderFlow||'none'}. Delivery: ${JSON.stringify(s.catalog?.delivery||{})}. Business-specific details: ${Object.entries(s.businessDetails||{}).filter(([,v])=>String(v).trim()).map(([k,v])=>`${k}: ${v}`).join('\\n')||'none'}. Sections: ${s.sections.join(', ')}. Pages: ${s.pages.join(', ')}. Features: ${s.features.join(', ')}. Audience: ${s.audience}. Brief: ${s.brief}.\nUploaded assets: ${s.assets.map(a=>a.name).join(', ')||'none'}. Use supplied asset filenames in assetNames. Write original, specific copy; no lorem ipsum or generic filler, and never invent awards, certifications, prices, addresses, or customer quotes. If Testimonials/Reviews are requested without supplied quotes, create an honest section explaining that approved customer quotes should be added before publishing rather than fabricating them. Return JSON with business, tagline, seo{title,description}, colors{primary,secondary,background,text}, typography{heading,body}, nav[], hero{eyebrow,headline,body,cta,assetName?}, sections[{type,title,body,items?,assetNames?}], contact{phone,whatsapp,email,address,hours}, footer.`;}
function extractJson(t:string){const f=t.match(/```json\s*([\s\S]*?)\s*```/i);if(f)return f[1];const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)return t.slice(a,b+1);throw new Error('AI provider returned no JSON object');}
class RetryableAIError extends Error{}
function validate(x:any){if(!x||typeof x.business!=='string'||!x.hero?.headline||!Array.isArray(x.sections))throw new Error('AI response failed NexaAI schema validation');}
async function requestGemini(s:BuilderState):Promise<WebsiteSpec>{const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('GEMINI_API_KEY is not configured on the server');const parts:any[]=[{text:promptFor(s)}];for(const a of s.assets||[])if(a.data?.startsWith('data:image/'))parts.push({inlineData:{mimeType:a.type,data:a.data.replace(/^data:[^;]+;base64,/,'')}});const c=new AbortController(),timer=setTimeout(()=>c.abort(),TIMEOUT_MS);try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL||'gemini-2.5-flash'}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',temperature:0.75}})});if(r.status===429||r.status>=500)throw new RetryableAIError(`Gemini temporary error ${r.status}`);if(!r.ok)throw new Error(`Gemini request failed (${r.status})`);const p:any=await r.json(),text=p?.candidates?.[0]?.content?.parts?.map((z:any)=>z.text||'').join('');if(!text)throw new RetryableAIError('Gemini returned an empty response');const parsed=JSON.parse(extractJson(text));validate(parsed);return {...parsed,features:s.features,catalogMode:s.catalog?.mode||'none',products:s.catalog?.products||[],services:s.catalog?.services||[],colors:{primary:parsed.colors?.primary||s.primary,secondary:parsed.colors?.secondary||s.secondary,background:parsed.colors?.background||'#f7f5f0',text:parsed.colors?.text||'#151515'},personality:s.styles.length?s.styles:['Modern','Premium'],imageRequirements:s.assets.map(a=>a.name),content:parsed.hero.body,cta:parsed.hero.cta,responsive:'Mobile-first with tablet and desktop adaptations',assets:s.assets} as WebsiteSpec;}finally{clearTimeout(timer);}}
export async function generateWebsite(s:BuilderState,onStage:(stage:string)=>void){let last:unknown;for(let attempt=0;attempt<=MAX_RETRIES;attempt++){try{onStage('Analyzing requirements');onStage('Planning website');onStage('Creating design system');onStage('Writing business content');onStage('Processing images');const result=await requestGemini(s);onStage('Building pages');onStage('Optimizing responsive layout');onStage('Running quality checks');onStage('Preparing preview');return result;}catch(e){last=e;const retryable=e instanceof RetryableAIError||(e instanceof Error&&/abort|timeout|empty response/i.test(e.message));if(!retryable||attempt===MAX_RETRIES)break;await new Promise(r=>setTimeout(r,1200*(attempt+1)));}}throw last instanceof Error?last:new Error('Website generation failed');}

export interface DirectPlan {
  category: string;
  businessName: string;
  description: string;
  location: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  socials: string;
  brief: string;
  audience: string;
  styles: string[];
  pages: string[];
  sections: string[];
  features: string[];
  catalogMode: 'products'|'menu'|'services'|'none';
  orderFlow: 'none'|'whatsapp'|'cart'|'checkout';
  products: Product[];
  services: ServiceItem[];
  businessDetails: Record<string,string>;
  clarifyingQuestions: string[];
}
const DIRECT_CATEGORIES=['Restaurant','Cafe','E-commerce','Real Estate','Portfolio','Agency','SaaS','Technology','Education','Healthcare','Fitness','Beauty / Salon','Hotel','Travel','Construction','Legal','Finance','Local Business','Personal Brand','Other'];
function directPrompt(brief:string, clarification:string){return `You are NexaAI's website planning assistant. Convert a customer's natural-language website request into a concise structured plan for the EXISTING NexaAI builder. Do not generate HTML. Use only these categories: ${DIRECT_CATEGORIES.join(', ')}. Infer the closest category; for a clothing shop use E-commerce when products are being sold, otherwise Local Business. Extract only information supported by the customer. Recommend pages, sections and features that fit the request. Extract products or services into structured arrays when the customer supplies them. Preserve exact names, prices, sale prices, categories, sizes, colors, stock, SKUs and image references when provided. Never invent missing product/service values; leave optional fields absent and ask a concise clarification only when a missing value is essential to the requested experience. For cafes/restaurants use catalogMode=menu and products for menu items. For service businesses use catalogMode=services and services for service offerings. For portfolios and businesses without a catalog use catalogMode=none unless the request explicitly provides services. If essential information is genuinely missing for a useful plan, ask only the minimum clarifying questions; do not ask for details that can be safely optional. Return strict JSON with category,businessName,description,location,phone,whatsapp,email,address,hours,socials,brief,audience,styles[],pages[],sections[],features[],catalogMode,orderFlow,products[],services[],businessDetails{},clarifyingQuestions[]. Keep pages/features aligned to the existing product vocabulary. Customer request: ${brief}\nAdditional clarification: ${clarification||'none'}`}
export async function planDirectBrief(brief:string, clarification=''):Promise<DirectPlan>{
  const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('GEMINI_API_KEY is not configured on the server');
  if(brief.trim().length<12)throw new Error('Tell NexaAI a little more about the website you want');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL||'gemini-2.5-flash'}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({contents:[{role:'user',parts:[{text:directPrompt(brief,clarification)}]}],generationConfig:{responseMimeType:'application/json',temperature:0.2}})});
    if(r.status===429||r.status>=500)throw new RetryableAIError(`Gemini temporary error ${r.status}`);
    if(!r.ok)throw new Error(`Gemini request failed (${r.status})`);
    const p:any=await r.json(),text=p?.candidates?.[0]?.content?.parts?.map((z:any)=>z.text||'').join('');
    if(!text)throw new RetryableAIError('Gemini returned an empty response');
    const x:any=JSON.parse(extractJson(text));
    if(!DIRECT_CATEGORIES.includes(x.category)||typeof x.businessName!=='string'||!Array.isArray(x.pages)||!Array.isArray(x.features)||!Array.isArray(x.sections)||!Array.isArray(x.styles)||!Array.isArray(x.clarifyingQuestions)||typeof x.businessDetails!=='object'||!['products','menu','services','none'].includes(x.catalogMode)||!['none','whatsapp','cart','checkout'].includes(x.orderFlow))throw new Error('AI direct plan failed NexaAI schema validation');
    const products=Array.isArray(x.products)?x.products.map((p:any)=>normalizeProduct(p)).filter(Boolean):[];
    const services=Array.isArray(x.services)?x.services.map((v:any)=>normalizeService(v)).filter(Boolean):[];
    return {...x,brief:brief.trim(),businessDetails:x.businessDetails||{},products,services,catalogMode:x.catalogMode} as DirectPlan;
  }finally{clearTimeout(timer);}
}

function normalizeProduct(p:any):Product|undefined{
  if(!p||typeof p!=='object'||typeof p.name!=='string'||!p.name.trim())return undefined;
  const out:Product={id:typeof p.id==='string'&&p.id?p.id:randomUUID(),name:p.name.trim()};
  for(const key of ['description','currency','category','size','color','stock','sku'] as const)if(typeof p[key]==='string'&&p[key].trim())out[key]=p[key].trim();
  for(const key of ['price','salePrice'] as const)if(typeof p[key]==='number'&&Number.isFinite(p[key])&&p[key]>=0)out[key]=p[key];
  if(Array.isArray(p.images))out.images=p.images.filter((v:any)=>typeof v==='string').slice(0,8);
  if(Array.isArray(p.variants))out.variants=p.variants.filter((v:any)=>v&&typeof v.label==='string'&&typeof v.value==='string').map((v:any)=>({id:typeof v.id==='string'&&v.id?v.id:crypto.randomUUID(),label:v.label,value:v.value})).slice(0,20);
  if(Array.isArray(p.tags))out.tags=p.tags.filter((v:any)=>typeof v==='string').slice(0,20);
  if(typeof p.featured==='boolean')out.featured=p.featured;
  if(p.customFields&&typeof p.customFields==='object')out.customFields=Object.fromEntries(Object.entries(p.customFields).filter(([,v])=>typeof v==='string')) as Record<string,string>;
  return out;
}
function normalizeService(v:any):ServiceItem|undefined{
  if(!v||typeof v!=='object'||typeof v.name!=='string'||!v.name.trim())return undefined;
  const out:ServiceItem={id:typeof v.id==='string'&&v.id?v.id:crypto.randomUUID(),name:v.name.trim()};
  for(const key of ['description','currency','category','image'] as const)if(typeof v[key]==='string'&&v[key].trim())out[key]=v[key].trim();
  if(typeof v.price==='number'&&Number.isFinite(v.price)&&v.price>=0)out.price=v.price;
  if(Array.isArray(v.tags))out.tags=v.tags.filter((x:any)=>typeof x==='string').slice(0,20);
  if(typeof v.featured==='boolean')out.featured=v.featured;
  return out;
}
