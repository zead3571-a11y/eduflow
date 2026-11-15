import QRCode from 'qrcode';
import { Student } from '../../types/eduflow';

export function encodeStudentQrPayload(student: Pick<Student, 'id' | 'code'>): string {
  return `EDUFLOW:STUDENT:${student.id}:${student.code}`;
}

export function parseStudentQrPayload(
  rawInput: string,
  students: Student[]
): Student | undefined {
  const cleaned = rawInput.trim();
  if (!cleaned) return undefined;

  if (cleaned.toUpperCase().startsWith('EDUFLOW:STUDENT:')) {
    const parts = cleaned.split(':');
    const idPart = parts[2];
    const codePart = parts[3];
    const byId = students.find((s) => s.id === idPart || s.code.toUpperCase() === codePart?.toUpperCase());
    if (byId) return byId;
  }

  const upper = cleaned.toUpperCase();
  return students.find(
    (s) =>
      s.code.toUpperCase() === upper ||
      s.id.toUpperCase() === upper ||
      s.parentPhone === cleaned
  );
}

export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 240,
    margin: 1,
    color: {
      dark: '#0F2A4A',
      light: '#FFFFFF',
    },
  });
}
