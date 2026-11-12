import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymobHmac, verifyPaymobHmac } from '../src/lib/paymob/hmac.mjs';

const transaction = {
  amount_cents: 12500, created_at: '2026-11-12T09:00:00.000000', currency: 'EGP', error_occured: false,
  has_parent_transaction: false, id: 987654, integration_id: 123456, is_3d_secure: true,
  is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true,
  is_voided: false, order: { id: 555001 }, owner: 112233, pending: false,
  source_data: { pan: '2346', sub_type: 'Visa', type: 'カード' }, success: true,
};

test('creates a 128-character SHA-512 hex HMAC', () => {
  const signature = createPaymobHmac(transaction, 'test-secret');
  assert.match(signature, /^[a-f0-9]{128}$/);
});

test('accepts a valid signature', () => {
  const signature = createPaymobHmac(transaction, 'test-secret');
  assert.equal(verifyPaymobHmac(transaction, signature, 'test-secret'), true);
});

test('rejects a changed transaction payload', () => {
  const signature = createPaymobHmac(transaction, 'test-secret');
  assert.equal(verifyPaymobHmac({ ...transaction, amount_cents: 12501 }, signature, 'test-secret'), false);
});

test('rejects malformed signatures without throwing', () => {
  assert.equal(verifyPaymobHmac(transaction, 'not-a-signature', 'test-secret'), false);
  assert.equal(verifyPaymobHmac(transaction, 'a'.repeat(127), 'test-secret'), false);
});
