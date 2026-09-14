import type { BuilderState, WebsiteSpec } from '../types';

export function buildWebsiteSpec(s: BuilderState): WebsiteSpec {
  const business = s.businessName || s.customBusiness || s.category;
  const personality = s.styles.length ? s.styles : ['Modern','Premium'];
  return { business, audience:s.audience || 'Customers looking for a credible, easy-to-use business website', personality, colors:{primary:s.primary,secondary:s.secondary}, typography:s.font, pages:s.pages, sections:s.sections, features:s.features, content:s.description || s.brief || `A professional ${s.category.toLowerCase()} website built around trust and conversion.`, imageRequirements:s.assets.length ? s.assets.map(a=>a.name) : ['High-quality brand photography','Editorial supporting imagery'], cta:s.whatsapp ? 'Start a WhatsApp conversation' : 'Get in touch', responsive:'Mobile-first layout with tablet and desktop adaptations' };
}

export async function generateWebsite(s: BuilderState, onProgress:(label:string)=>void): Promise<WebsiteSpec> {
  const stages=['Analyzing your requirements','Planning website structure','Generating design','Adding content','Optimizing images','Running quality check','Finalizing website'];
  for (const stage of stages) { onProgress(stage); await new Promise(r=>setTimeout(r,420)); }
  return buildWebsiteSpec(s);
}

export function websiteHtml(spec: WebsiteSpec): string {
  const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const sections=spec.sections.map(x=>`<section><div class="container"><p class="eyebrow">${esc(spec.business)}</p><h2>${esc(x)}</h2><p>${esc(spec.content)}</p></div></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(spec.content)}"><title>${esc(spec.business)}</title><style>body{margin:0;font-family:${esc(spec.typography)},Arial,sans-serif;color:#111;background:#f8f7f4}header,section,footer{padding:72px 24px}.container{max-width:1080px;margin:auto}h1{font-size:clamp(44px,7vw,92px);line-height:.95;margin:12px 0}h2{font-size:48px}.eyebrow{letter-spacing:.16em;text-transform:uppercase;font-size:12px}a,button{display:inline-block;padding:14px 20px;border-radius:999px;text-decoration:none;background:${spec.colors.primary};color:#111}</style></head><body><header><div class="container"><p class="eyebrow">${esc(spec.personality.join(' · '))}</p><h1>${esc(spec.business)}</h1><p>${esc(spec.content)}</p><a href="#contact">${esc(spec.cta)}</a></div></header>${sections}<footer id="contact"><div class="container"><strong>${esc(spec.business)}</strong><p>Built with NexaAI.</p></div></footer></body></html>`;
}
