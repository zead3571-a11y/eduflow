export type PaymobHmacTransaction = {
  amount_cents?: number | string; created_at?: string; currency?: string; error_occured?: boolean;
  has_parent_transaction?: boolean; id?: number | string; integration_id?: number | string;
  is_3d_secure?: boolean; is_auth?: boolean; is_capture?: boolean; is_refunded?: boolean;
  is_standalone_payment?: boolean; is_voided?: boolean; order?: { id?: number | string };
  owner?: number | string; pending?: boolean; source_data?: { pan?: string | null; sub_type?: string | null; type?: string | null };
  success?: boolean;
};
export function createPaymobHmac(obj: PaymobHmacTransaction, secret: string): string;
export function verifyPaymobHmac(obj: PaymobHmacTransaction, received: string, secret: string): boolean;
