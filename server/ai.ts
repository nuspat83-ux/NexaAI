import type { BuilderState, WebsiteSpec } from './types.js';

const MAX_RETRIES = 2;
const TIMEOUT_MS = 90000;

function promptFor(state: BuilderState) {
  return `You are NexaAI, a senior web designer, UX writer and information architect. Generate a complete, business-specific website specification as strict JSON only.
Business category: ${state.category}. Business name: ${state.businessName || state.customBusiness || 'Not supplied'}.
Tagline: ${state.tagline}. Description: ${state.description}. Location: ${state.location}. Phone: ${state.phone}. WhatsApp: ${state.whatsapp}. Email: ${state.email}. Address: ${state.address}. Hours: ${state.hours}. Socials: ${state.socials}.
Visual direction: ${state.styles.join(', ')}. Theme: ${state.theme}. Preferred colors: ${state.primary} / ${state.secondary}. Font: ${state.font}.
Sections: ${state.sections.join(', ')}. Pages: ${state.pages.join(', ')}. Features: ${state.features.join(', ')}.
Audience: ${state.audience}. Detailed brief: ${state.brief}.
Uploaded asset filenames: ${state.assets.map(a=>a.name).join(', ') || 'none'}.
Write original copy with no lorem ipsum or generic filler. Use the provided business facts. Plan section types from this set: about, services, products, portfolio, testimonials, pricing, faq, team, contact, location, booking, gallery, blog, cta. Each section must include concrete title/body and useful items where relevant. Return: business, tagline, seo{title,description}, colors{primary,secondary,background,text}, typography{heading,body}, nav[], hero{eyebrow,headline,body,cta,assetName?}, sections[], contact{phone,whatsapp,email,address,hours}, footer, and asset usage guidance in each relevant section via assetNames. Keep claims factual; never invent awards, certifications, reviews, addresses or prices.`;
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i); if (fenced) return fenced[1];
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  throw new Error('AI provider returned no JSON object');
}

async function requestGemini(state: BuilderState): Promise<WebsiteSpec> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured on the server');
  const parts: any[] = [{ text: promptFor(state) }];
  for (const asset of state.assets || []) {
    if (asset.data && asset.type.startsWith('image/')) {
      parts.push({ inlineData: { mimeType: asset.type, data: asset.data.replace(/^data:[^;]+;base64,/, '') } });
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${encodeURIComponent(key)}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
      body:JSON.stringify({ contents:[{ role:'user', parts }], generationConfig:{ responseMimeType:'application/json', temperature:0.8 } })
    });
    if (res.status === 429 || res.status >= 500) throw new RetryableAIError(`Gemini temporary error ${res.status}`);
    if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
    const payload:any = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('');
    if (!text) throw new Error('Gemini returned an empty response');
    const parsed = JSON.parse(extractJson(text));
    validateSpec(parsed);
    return parsed as WebsiteSpec;
  } finally { clearTimeout(timer); }
}

class RetryableAIError extends Error {}
function validateSpec(spec:any) {
  if (!spec || typeof spec.business!=='string' || !spec.hero?.headline || !Array.isArray(spec.sections)) throw new Error('AI response failed NexaAI schema validation');
}

export async function generateWebsite(state: BuilderState, onStage:(stage:string)=>void) {
  const stages=['Analyzing requirements','Planning website','Creating design system','Writing business content','Processing images','Building pages','Optimizing responsive layout','Running quality checks','Preparing preview'];
  for (const stage of stages) onStage(stage);
  let last: unknown;
  for (let attempt=0; attempt<=MAX_RETRIES; attempt++) {
    try {
      return await requestGemini(state);
    } catch (error) {
      last = error;
      const retryable = error instanceof RetryableAIError || (error instanceof Error && /timeout|abort|empty response/i.test(error.message));
      if (!retryable || attempt === MAX_RETRIES) break;
      await new Promise(r=>setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error('Website generation failed');
}
