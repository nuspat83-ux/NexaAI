import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import crypto from 'node:crypto';
import { calculatePrice, itemizePrice } from '../server/pricing.js';
import { verifyCheckoutSignature } from '../server/payment.js';

test('starter price never falls below ₹4,999 and basic features are included', () => {
  const price = calculatePrice({ plan:'Starter', pages:['Home','About','Contact','Gallery'], features:['WhatsApp button','Contact form','Google Maps','SEO setup'] });
  assert.equal(price, 4999);
});

test('advanced scope is itemized server-side', () => {
  const pricing = itemizePrice({ plan:'Starter', pages:['Home','About','Contact','Gallery','FAQ'], features:['Gallery','Booking form','Custom animations'] });
  assert.equal(pricing.extraPages, 1);
  assert.equal(pricing.extraPageAmount, 750);
  assert.equal(pricing.featureAmount, 1250);
  assert.equal(pricing.total, 6999);
});

test('Razorpay checkout signature is verified from the server secret', () => {
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  const orderId='order_test_123';
  const paymentId='pay_test_456';
  const signature=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  assert.equal(verifyCheckoutSignature(orderId,paymentId,signature), true);
  assert.equal(verifyCheckoutSignature(orderId,paymentId,signature.slice(0,-1)+'0'), false);
});
