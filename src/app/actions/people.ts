'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const studentSchema = z.object({
  centerId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  studentCode: z.string().trim().max(40).optional(),
  guardianName: z.string().trim().max(160).optional(),
  guardianPhone: z.string().trim().max(30).optional(),
});

const teacherSchema = z.object({
  centerId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  specialty: z.string().trim().max(120).optional(),
});

export async function createStudent(formData: FormData) {
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('بيانات الطالب غير صحيحة.');
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: student, error } = await supabase.from('students').insert({
    center_id: v.centerId,
    full_name: v.fullName,
    phone: v.phone || null,
    email: v.email || null,
    student_code: v.studentCode || null,
  }).select('id').single();
  if (error) throw new Error(error.message);

  if (v.guardianName && v.guardianPhone) {
    const { data: guardian, error: guardianError } = await supabase.from('guardians').insert({
      center_id: v.centerId, full_name: v.guardianName, phone: v.guardianPhone,
    }).select('id').single();
    if (guardianError) throw new Error(guardianError.message);
    const { error: linkError } = await supabase.from('student_guardians').insert({
      center_id: v.centerId, student_id: student.id, guardian_id: guardian.id, is_primary: true,
    });
    if (linkError) throw new Error(linkError.message);
  }
  revalidatePath(`/app/${v.centerId}/students`);
  redirect(`/app/${v.centerId}/students?created=1`);
}

export async function createTeacher(formData: FormData) {
  const parsed = teacherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('بيانات المدرس غير صحيحة.');
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.from('teachers').insert({
    center_id: v.centerId, full_name: v.fullName, phone: v.phone || null,
    email: v.email || null, specialty: v.specialty || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${v.centerId}/teachers`);
  redirect(`/app/${v.centerId}/teachers?created=1`);
}
