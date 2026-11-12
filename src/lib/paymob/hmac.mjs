import { createHmac, timingSafeEqual } from 'node:crypto';

const HMAC_FIELDS = [
  (o) => o.amount_cents, (o) => o.created_at, (o) => o.currency, (o) => o.error_occured,
  (o) => o.has_parent_transaction, (o) => o.id, (o) => o.integration_id, (o) => o.is_3d_secure,
  (o) => o.is_auth, (o) => o.is_capture, (o) => o.is_refunded, (o) => o.is_standalone_payment,
  (o) => o.is_voided, (o) => o.order?.id, (o) => o.owner, (o) => o.pending,
  (o) => o.source_data?.pan, (o) => o.source_data?.sub_type, (o) => o.source_data?.type, (o) => o.success,
];

function asPaymobString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export function createPaymobHmac(obj, secret) {
  const message = HMAC_FIELDS.map((get) => asPaymobString(get(obj))).join('');
  return createHmac('sha512', secret).update(message).digest('hex');
}

export function verifyPaymobHmac(obj, received, secret) {
  if (typeof received !== 'string' || !/^[a-f0-9]{128}$/i.test(received)) return false;
  const expected = Buffer.from(createPaymobHmac(obj, secret), 'hex');
  const actual = Buffer.from(received, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
