export const PLAN_PRICES: Record<string, number> = { Starter: 4999, Professional: 7999, Business: 11999, Premium: 17999 };
export const PAGE_PRICE = 750;
export const FEATURE_PRICES: Record<string, number> = {
  'WhatsApp button': 0, 'Contact form': 0, 'Lead capture': 250, 'Google Maps': 0, 'Social media links': 0,
  Testimonials: 0, Reviews: 250, FAQ: 0, Gallery: 0, 'Booking form': 750, Newsletter: 500, Search: 750,
  'Product catalog': 1000, 'Pricing calculator': 1000, 'Chat widget': 1000, 'Analytics-ready': 0,
  'SEO setup': 0, 'Cookie banner': 250, 'Custom animations': 500
};
const INCLUDED_PAGES: Record<string, number> = { Starter: 4, Professional: 7, Business: 10, Premium: 15 };

export function calculatePrice(state: { plan: string; pages: string[]; features: string[] }) {
  const plan = state.plan in PLAN_PRICES ? state.plan : 'Starter';
  const included = INCLUDED_PAGES[plan];
  const extraPages = Math.max(0, state.pages.length - included);
  const featureTotal = state.features.reduce((sum, feature) => sum + (FEATURE_PRICES[feature] ?? 0), 0);
  return PLAN_PRICES[plan] + extraPages * PAGE_PRICE + featureTotal;
}

export function itemizePrice(state: { plan: string; pages: string[]; features: string[] }) {
  const plan = state.plan in PLAN_PRICES ? state.plan : 'Starter';
  const included = INCLUDED_PAGES[plan];
  const extraPages = Math.max(0, state.pages.length - included);
  const features = state.features.filter((x) => (FEATURE_PRICES[x] ?? 0) > 0).map((name) => ({ name, amount: FEATURE_PRICES[name] }));
  return {
    basePlan: plan,
    baseAmount: PLAN_PRICES[plan],
    includedPages: included,
    selectedPages: state.pages.length,
    extraPages,
    extraPageAmount: extraPages * PAGE_PRICE,
    features,
    featureAmount: features.reduce((n, x) => n + x.amount, 0),
    total: calculatePrice(state)
  };
}
