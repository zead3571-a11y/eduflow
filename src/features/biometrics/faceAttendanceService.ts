import { ConsentRecord, FaceTemplateRecord, Student } from '../../types/eduflow';
import { sha256Hex } from '../../utils/authCrypto';

export function hasActiveBiometricConsent(
  consents: ConsentRecord[],
  studentId: string
): boolean {
  const matching = consents
    .filter((c) => c.studentId === studentId && c.type === 'biometric_face')
    .sort((a, b) => (b.grantedAt || '').localeCompare(a.grantedAt || ''));
  if (matching.length === 0) return false;
  const latest = matching[0];
  return latest.granted && !latest.revokedAt;
}

export function getActiveFaceTemplate(
  faceTemplates: FaceTemplateRecord[],
  studentId: string
): FaceTemplateRecord | undefined {
  return faceTemplates.find((f) => f.studentId === studentId && f.status === 'active');
}

export async function createDeterministicFaceHash(sampleSignature: string): Promise<string> {
  return sha256Hex(`EDUFLOW-FACE-V1:${sampleSignature.trim()}`);
}

export interface FaceMatchResult {
  matched: boolean;
  confidence: number;
  reason?: string;
}

export function verifyFaceAttendanceMatch(params: {
  student: Student;
  consents: ConsentRecord[];
  faceTemplates: FaceTemplateRecord[];
  capturedHash: string;
}): FaceMatchResult {
  const { student, consents, faceTemplates, capturedHash } = params;
  if (!hasActiveBiometricConsent(consents, student.id)) {
    return {
      matched: false,
      confidence: 0,
      reason: `لا توجد موافقة سارية من ولي أمر الطالب "${student.name}" لتسجيل الحضور بالبصمة.`,
    };
  }
  const tpl = getActiveFaceTemplate(faceTemplates, student.id);
  if (!tpl) {
    return {
      matched: false,
      confidence: 0,
      reason: `لم يتم تسجيل بصمة وجه للطالب "${student.name}" بعد.`,
    };
  }
  if (tpl.descriptorHash === capturedHash) {
    return { matched: true, confidence: 97 };
  }
  return {
    matched: false,
    confidence: 42,
    reason: 'لم يتطابق نموذج الوجه الملتقط مع البصمة المسجلة.',
  };
}
