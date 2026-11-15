import { AttendanceSession, Group, Invoice, PaymentRecord, Student } from '../../types/eduflow';
import { normalizePhoneDigits } from '../../permissions/permissions';
import { formatEGP, interpolateTemplate } from '../../utils/eduflowLogic';

/**
 * Normalizes Egyptian local phone numbers (e.g. 01002349871) into international WhatsApp format (201002349871).
 */
export function toWhatsAppPhone(phone: string): string {
  const clean = normalizePhoneDigits(phone);
  if (!clean) return '';
  if (clean.startsWith('0') && clean.length === 11) {
    return `20${clean.slice(1)}`;
  }
  if (clean.startsWith('20')) return clean;
  return clean;
}

export function buildWhatsAppUrl(phone: string, body: string): string {
  const waPhone = toWhatsAppPhone(phone);
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(body)}`;
}

export function buildAbsenceMessage(
  templateBody: string,
  params: {
    student: Student;
    group?: Group;
    session?: AttendanceSession;
  }
): string {
  return interpolateTemplate(templateBody, {
    اسم_الطالب: params.student.name,
    التاريخ: params.session?.date || 'اليوم',
    المجموعة: params.group?.name || 'المجموعة',
    الموعد: params.session?.timeLabel || '',
  });
}

export function buildLatePaymentMessage(
  templateBody: string,
  params: {
    student: Student;
    group?: Group;
    invoice: Invoice;
  }
): string {
  const remaining = Math.max(0, params.invoice.netAmount - params.invoice.paid);
  return interpolateTemplate(templateBody, {
    اسم_الطالب: params.student.name,
    المبلغ: String(remaining),
    المجموعة: params.group?.name || 'المجموعة',
    التاريخ: params.invoice.dueDate,
  });
}

export function buildReceiptMessage(params: {
  centerName: string;
  student?: Student;
  group?: Group;
  payment: PaymentRecord;
}): string {
  return [
    `إيصال سداد من ${params.centerName}`,
    `رقم الإيصال: #${params.payment.receiptNumber}`,
    `الطالب: ${params.student?.name || ''}`,
    `المجموعة: ${params.group?.name || ''}`,
    `المبلغ المدفوع: ${formatEGP(params.payment.amount)} (${params.payment.method})`,
    `المتبقي: ${formatEGP(params.payment.remainingAfter)}`,
    `التاريخ: ${params.payment.date}`,
  ].join('\n');
}
