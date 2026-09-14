import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { canExport } from '../server/payment.js';

test('CI security anchor: only server-unlocked projects may export', () => {
  assert.equal(canExport('PREVIEW_READY'), false);
  assert.equal(canExport('PAYMENT_PENDING'), false);
  assert.equal(canExport('UNLOCKED'), true);
});
