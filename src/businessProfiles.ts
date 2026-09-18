import type { BuilderState } from './types';

export type BusinessFieldKey =
  | 'businessName' | 'description' | 'location' | 'address' | 'phone' | 'whatsapp' | 'email'
  | 'hours' | 'products' | 'productCategories' | 'menu' | 'services' | 'pricing' | 'reviews'
  | 'delivery' | 'payment' | 'projects' | 'skills' | 'team' | 'caseStudies' | 'socials';

export interface BusinessQuestion {
  key: BusinessFieldKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

export interface BusinessProfile {
  id: string;
  categories: string[];
  description: string;
  questions: BusinessQuestion[];
  recommendedPages: string[];
  recommendedFeatures: string[];
  recommendedSections: string[];
  generationContext: string;
}

const common: BusinessQuestion[] = [
  { key: 'businessName', label: 'Business / brand name', placeholder: 'e.g. Atelier 27' },
  { key: 'description', label: 'What does the business do?', placeholder: 'Tell customers what you offer and why it matters.', multiline: true },
  { key: 'location', label: 'Location', placeholder: 'e.g. Mumbai, India' },
  { key: 'phone', label: 'Phone', placeholder: '+91…' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+91…' },
  { key: 'email', label: 'Email', placeholder: 'hello@business.com' },
];

export const businessProfiles: BusinessProfile[] = [
  {
    id: 'food',
    categories: ['Restaurant', 'Cafe'],
    description: 'Food and hospitality businesses need menu, location, hours and conversion-focused ordering or reservation information.',
    questions: [
      ...common,
      { key: 'menu', label: 'Menu / menu categories', placeholder: 'e.g. Breakfast, mains, desserts; add item names and prices if ready.', multiline: true },
      { key: 'hours', label: 'Opening hours', placeholder: 'Mon–Sun · 9am–11pm' },
      { key: 'address', label: 'Address', placeholder: 'Street, area, city' },
      { key: 'reviews', label: 'Reviews / testimonials', placeholder: 'Paste approved customer quotes, if available.', multiline: true },
      { key: 'delivery', label: 'Ordering / reservation details', placeholder: 'WhatsApp ordering, online order, table booking, etc.', multiline: true },
    ],
    recommendedPages: ['Home', 'About', 'Gallery', 'Contact', 'Booking'],
    recommendedFeatures: ['WhatsApp button', 'Contact form', 'Google Maps', 'Gallery', 'Reviews', 'Booking form', 'SEO setup'],
    recommendedSections: ['Hero', 'About', 'Products', 'Testimonials', 'Location', 'Booking', 'Gallery', 'Contact', 'CTA sections'],
    generationContext: 'Create a hospitality website with clear menu/product discovery, trust, location, hours and an obvious order/reservation path.',
  },
  {
    id: 'commerce',
    categories: ['E-commerce'],
    description: 'Online stores need product/catalog information, variants, pricing and the intended cart, checkout and delivery journey.',
    questions: [
      ...common,
      { key: 'products', label: 'Products', placeholder: 'Product names, descriptions, prices and key details.', multiline: true },
      { key: 'productCategories', label: 'Product categories', placeholder: 'e.g. Dresses, tops, accessories' },
      { key: 'pricing', label: 'Prices / sale prices', placeholder: 'Tell us the pricing structure or paste a product list.', multiline: true },
      { key: 'delivery', label: 'Delivery information', placeholder: 'Delivery areas, timing, charges or pickup.' },
      { key: 'payment', label: 'Payment requirements', placeholder: 'e.g. Online payment, COD, WhatsApp ordering' },
    ],
    recommendedPages: ['Home', 'Products', 'About', 'Contact', 'Privacy Policy', 'Terms'],
    recommendedFeatures: ['Product catalog', 'Search', 'WhatsApp button', 'Contact form', 'SEO setup', 'Social media links'],
    recommendedSections: ['Hero', 'Products', 'About', 'Testimonials', 'FAQ', 'Contact', 'CTA sections'],
    generationContext: 'Design a commerce-ready presentation and catalog experience. Do not invent inventory or prices; use supplied product data and keep advanced checkout implementation scoped to the requested features.',
  },
  {
    id: 'service',
    categories: ['Local Business', 'Real Estate', 'Construction', 'Legal', 'Finance', 'Healthcare', 'Fitness', 'Beauty / Salon', 'Hotel', 'Travel'],
    description: 'Service businesses need strong service discovery, trust, contact/enquiry conversion and local information.',
    questions: [
      ...common,
      { key: 'services', label: 'Services', placeholder: 'List your main services and what each includes.', multiline: true },
      { key: 'pricing', label: 'Pricing', placeholder: 'Optional: starting prices, packages or “contact for quote”.', multiline: true },
      { key: 'address', label: 'Address', placeholder: 'Street, area, city' },
      { key: 'hours', label: 'Opening hours', placeholder: 'Mon–Sat · 9am–7pm' },
      { key: 'reviews', label: 'Reviews / testimonials', placeholder: 'Paste approved customer quotes, if available.', multiline: true },
    ],
    recommendedPages: ['Home', 'Services', 'About', 'Gallery', 'Contact'],
    recommendedFeatures: ['WhatsApp button', 'Contact form', 'Lead capture', 'Google Maps', 'Reviews', 'Gallery', 'SEO setup'],
    recommendedSections: ['Hero', 'Services', 'About', 'Testimonials', 'Gallery', 'Location', 'Contact', 'CTA sections'],
    generationContext: 'Prioritize trust, local discoverability, service clarity and a low-friction enquiry/contact CTA.',
  },
  {
    id: 'portfolio',
    categories: ['Portfolio', 'Personal Brand'],
    description: 'Portfolios need a strong personal introduction, work showcase, credibility and contact path.',
    questions: [
      { key: 'businessName', label: 'Name', placeholder: 'Your name or brand' },
      { key: 'description', label: 'About you', placeholder: 'Profession, story and positioning.', multiline: true },
      { key: 'services', label: 'Services', placeholder: 'What can clients hire you for?', multiline: true },
      { key: 'projects', label: 'Projects', placeholder: 'Project names, outcomes and links.', multiline: true },
      { key: 'skills', label: 'Skills', placeholder: 'Key skills, tools or specialties' },
      { key: 'reviews', label: 'Testimonials', placeholder: 'Paste approved testimonials, if available.', multiline: true },
      ...common.filter(x => ['phone','whatsapp','email','location'].includes(x.key)),
    ],
    recommendedPages: ['Home', 'About', 'Portfolio', 'Contact'],
    recommendedFeatures: ['Contact form', 'Social media links', 'Testimonials', 'Gallery', 'SEO setup'],
    recommendedSections: ['Hero', 'About', 'Services', 'Portfolio', 'Testimonials', 'Contact', 'CTA sections'],
    generationContext: 'Make the work and personal positioning the visual focus, with concise credibility signals and a clear contact path.',
  },
  {
    id: 'agency',
    categories: ['Agency', 'Technology', 'SaaS', 'Education'],
    description: 'Agencies and companies need service/product positioning, team credibility, proof and a clear conversion CTA.',
    questions: [
      ...common,
      { key: 'services', label: 'Services / products', placeholder: 'What do you provide?', multiline: true },
      { key: 'team', label: 'Team', placeholder: 'Names, roles and short bios, if relevant.', multiline: true },
      { key: 'caseStudies', label: 'Portfolio / case studies', placeholder: 'Projects, clients or outcomes you can publish.', multiline: true },
      { key: 'reviews', label: 'Testimonials', placeholder: 'Paste approved customer quotes, if available.', multiline: true },
    ],
    recommendedPages: ['Home', 'About', 'Services', 'Portfolio', 'Contact'],
    recommendedFeatures: ['Contact form', 'Lead capture', 'Testimonials', 'FAQ', 'SEO setup', 'Social media links'],
    recommendedSections: ['Hero', 'Services', 'Portfolio', 'Team', 'Testimonials', 'FAQ', 'Contact', 'CTA sections'],
    generationContext: 'Build a credible company experience with clear positioning, proof, services/products and a strong lead CTA.',
  },
];

const defaultProfile: BusinessProfile = {
  id: 'general',
  categories: [],
  description: 'Use a flexible business profile and let the customer choose the relevant content.',
  questions: common,
  recommendedPages: ['Home', 'About', 'Contact'],
  recommendedFeatures: ['WhatsApp button', 'Contact form', 'SEO setup'],
  recommendedSections: ['Hero', 'About', 'Services', 'Contact', 'CTA sections'],
  generationContext: 'Use the customer brief to determine the most relevant structure without inventing unsupported business facts.',
};

export function getBusinessProfile(category: string): BusinessProfile {
  return businessProfiles.find(profile => profile.categories.includes(category)) || defaultProfile;
}

export function profileDefaults(category: string) {
  const p = getBusinessProfile(category);
  return {
    pages: p.recommendedPages,
    features: p.recommendedFeatures,
    sections: p.recommendedSections,
  };
}

export function businessDetailText(state: BuilderState) {
  return Object.entries(state.businessDetails || {})
    .filter(([, value]) => String(value).trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}
