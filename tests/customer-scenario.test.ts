import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculatePrice, itemizePrice } from '../server/pricing.js';
import { canExport } from '../server/payment.js';
import { websiteHtml } from '../server/render.js';
import type { WebsiteSpec } from '../server/types.js';

const restaurant: WebsiteSpec = {
  business: 'Premium Indian Restaurant',
  tagline: 'Contemporary Indian dining with a refined point of view.',
  seo: {
    title: 'Premium Indian Restaurant | Modern Indian Dining',
    description: 'A luxury Indian restaurant serving contemporary cuisine in an elegant dining setting.'
  },
  colors: { primary: '#C9A46C', secondary: '#111318', background: '#101114', text: '#F6F0E5' },
  typography: { heading: 'Playfair Display', body: 'DM Sans' },
  nav: ['Home', 'About', 'Menu', 'Gallery', 'Contact'],
  hero: {
    eyebrow: 'Contemporary Indian dining',
    headline: 'Indian cuisine, beautifully reimagined.',
    body: 'A polished dining experience built around regional Indian flavours, seasonal ingredients and warm, attentive hospitality.',
    cta: 'Reserve your table',
    assetName: 'restaurant-hero.jpg'
  },
  sections: [
    { type: 'about', title: 'A modern expression of Indian hospitality', body: 'Our menu brings familiar Indian flavours into a contemporary setting, balancing depth, texture and restraint.', assetNames: ['restaurant-interior.jpg'] },
    { type: 'menu', title: 'A menu designed around flavour', body: 'Explore a focused selection of contemporary Indian plates, from small plates to signature mains and desserts.', items: ['Tandoori cauliflower with smoked yoghurt', 'Charred paneer with black garlic', 'Saffron pulao with seasonal vegetables'] },
    { type: 'gallery', title: 'Inside the dining room', body: 'Discover the atmosphere, plates and details that shape the experience.', assetNames: ['restaurant-interior.jpg', 'signature-dish.jpg'] },
    { type: 'testimonials', title: 'What guests remember', body: 'Guest quotes are intentionally not fabricated. Approved customer feedback can be added before publishing.' },
    { type: 'contact', title: 'Visit us', body: 'Plan your visit, ask a question or start a conversation with the restaurant team.' }
  ],
  contact: { phone: '+91 9876543210', whatsapp: '+91 9876543210', email: 'hello@premiumindianrestaurant.com', address: 'Lower Parel, Mumbai, Maharashtra, India', hours: 'Mon-Sun · 12pm-11:30pm' },
  footer: 'Contemporary Indian dining in Mumbai.',
  features: ['WhatsApp button', 'Google Maps', 'Contact form', 'Testimonials', 'Gallery', 'SEO setup'],
  assets: [
    { name: 'restaurant-hero.jpg', type: 'image/jpeg', url: 'data:image/jpeg;base64,AAAA', data: 'data:image/jpeg;base64,AAAA' },
    { name: 'restaurant-interior.jpg', type: 'image/jpeg', url: 'data:image/jpeg;base64,BBBB', data: 'data:image/jpeg;base64,BBBB' },
    { name: 'signature-dish.jpg', type: 'image/jpeg', url: 'data:image/jpeg;base64,CCCC', data: 'data:image/jpeg;base64,CCCC' }
  ]
};

test('exact restaurant scope keeps basics inexpensive', () => {
  const state = {
    plan: 'Starter',
    pages: ['Home', 'About', 'Menu', 'Gallery', 'Contact'],
    features: ['WhatsApp button', 'Google Maps', 'Contact form', 'Testimonials', 'Gallery', 'SEO setup', 'Analytics-ready']
  };
  assert.equal(calculatePrice(state), 5749);
  const itemized = itemizePrice(state);
  assert.equal(itemized.baseAmount, 4999);
  assert.equal(itemized.extraPages, 1);
  assert.equal(itemized.featureAmount, 0);
});

test('generated restaurant export contains the selected customer experience', () => {
  const html = websiteHtml(restaurant);
  for (const needle of [
    'Premium Indian Restaurant',
    'Contemporary Indian dining',
    'restaurant-hero.jpg',
    'mailto:hello@premiumindianrestaurant.com',
    'google.com/maps/search',
    'wa.me/',
    'application/ld+json',
    'Open navigation',
    'Send enquiry'
  ]) assert.match(html, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /lorem ipsum/i);
  assert.doesNotMatch(html, /coming soon|not implemented|placeholder|dummy|fake/i);
});

test('export policy remains locked before verified payment', () => {
  for (const status of ['DRAFT', 'CONFIGURED', 'GENERATING', 'PREVIEW_READY', 'PAYMENT_PENDING', 'PAID']) {
    assert.equal(canExport(status), false, `${status} must remain locked`);
  }
  assert.equal(canExport('UNLOCKED'), true);
  assert.equal(canExport('EXPORTED'), true);
});
