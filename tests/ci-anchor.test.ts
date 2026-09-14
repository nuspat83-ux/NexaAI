import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculatePrice } from '../server/pricing.js';

test('CI anchor: restaurant starter scope remains ₹5,749', () => {
  assert.equal(calculatePrice({
    plan: 'Starter',
    pages: ['Home','About','Menu','Gallery','Contact'],
    features: ['WhatsApp button','Google Maps','Contact form','Testimonials','Gallery','SEO setup']
  }), 5749);
});
