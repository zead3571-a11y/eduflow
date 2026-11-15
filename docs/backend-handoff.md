# EDUFLOW — Backend & Supabase Migration Handoff

هذا المستند يحدد هيكل قاعدة البيانات (Postgres / Supabase) وسياسات أمان الصفوف (**Row-Level Security — RLS**) المطلوبة لاستبدال `LocalStorageAdapter` بمحول `SupabaseAdapter` لاحقاً دون تعديل شاشات الواجهة.

---

## 1. معمارية العزل والربط (Architecture Overview)

- جميع الشاشات تتعامل مع البيانات حصراً عبر طبقة المستودعات (`src/data/repositories.ts`) وعقد `StorageAdapter` (`src/data/storageAdapter.ts`).
- كل كيان يحمل عمود `center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE` لعزل بيانات كل سنتر تعليمي بالكامل (`Multi-tenant isolation`).
- في الإنتاج، يتم استبدال تجزئة كلمات السر التجريبية (`SHA-256 + salt` في `src/utils/authCrypto.ts`) بمصادقة **Supabase Auth** (`auth.users`) مع ربط جدول `users.auth_uid -> auth.users.id`.

---

## 2. مخطط الجداول (Postgres Schema)

```sql
-- 1) Centers
CREATE TABLE centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  phone TEXT NOT NULL,
  stages TEXT[] NOT NULL DEFAULT '{}',
  current_plan_id TEXT NOT NULL DEFAULT 'pro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Users (Staff, Teachers & Parent Portal Accounts)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE,
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('مالك', 'مدير', 'محاسب', 'ريسبشن', 'مدرس', 'ولي أمر')),
  status TEXT NOT NULL CHECK (status IN ('active', 'invited')) DEFAULT 'active',
  teacher_id UUID NULL,
  invitation_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, email),
  UNIQUE (center_id, phone)
);

-- 3) Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 40
);

-- 4) Teachers
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  compensation_type TEXT NOT NULL CHECK (compensation_type IN ('percent', 'rent')),
  center_percent NUMERIC(5,2),
  rent_amount NUMERIC(10,2),
  has_login_access BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#0F766E'
);

-- 5) Students (unique student code S-000123 per center)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  stage TEXT NOT NULL,
  phone TEXT,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  standing_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_fee_override NUMERIC(10,2),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, code)
);

-- 6) Groups & Enrollments
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  stage TEXT NOT NULL,
  days TEXT[] NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id UUID REFERENCES rooms(id),
  room_name TEXT NOT NULL,
  capacity INT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'full', 'paused')) DEFAULT 'active'
);

CREATE TABLE group_enrollments (
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, student_id)
);

-- 7) Sessions & Attendance Records
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('regular', 'makeup')) DEFAULT 'regular',
  original_session_id UUID REFERENCES sessions(id),
  time_label TEXT NOT NULL,
  room_id UUID REFERENCES rooms(id),
  status TEXT NOT NULL CHECK (status IN ('recorded', 'pending', 'upcoming')) DEFAULT 'upcoming'
);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'unrecorded')),
  method TEXT NOT NULL CHECK (method IN ('manual', 'qr', 'face')) DEFAULT 'manual',
  confidence NUMERIC(5,4),
  marked_by UUID REFERENCES users(id),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  compensated_by UUID REFERENCES sessions(id),
  UNIQUE (session_id, student_id)
);

-- 8) Invoices, Discounts, Payments, Expenses, Settlements
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  invoice_id UUID NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'percent')),
  value NUMERIC(10,2) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id),
  month TEXT NOT NULL, -- YYYY-MM
  base_amount NUMERIC(10,2) NOT NULL,
  discount_lines JSONB NOT NULL DEFAULT '[]',
  net_amount NUMERIC(10,2) NOT NULL,
  paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'partial', 'pending', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, number)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  remaining_after NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL,
  date DATE NOT NULL,
  recorded_by UUID REFERENCES users(id),
  note TEXT,
  UNIQUE (center_id, receipt_number)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  added_by UUID REFERENCES users(id),
  attachment_name TEXT
);

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  month TEXT NOT NULL,
  gross_revenue NUMERIC(10,2) NOT NULL,
  teacher_share NUMERIC(10,2) NOT NULL,
  center_share NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'settled')),
  settled_at TIMESTAMPTZ,
  settled_by UUID REFERENCES users(id),
  note TEXT
);

-- 9) Assessments, Outbox Messages, Activity Log, Consents, Face Templates
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  max_score NUMERIC(6,2) NOT NULL,
  status TEXT NOT NULL,
  grades JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  template_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  summary TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_phone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('biometric_face', 'messaging')),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  captured_by UUID REFERENCES users(id)
);

CREATE TABLE face_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  descriptor_encrypted TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_by UUID REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'deleted')) DEFAULT 'active'
);
```

---

## 3. دوال مساعدة وسياسات الأمان (RLS Policies)

تُفعّل `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` على جميع الجداول أعلاه مع الدوال المساعدة التالية:

```sql
CREATE OR REPLACE FUNCTION auth_user_row()
RETURNS users LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM users WHERE auth_uid = auth.uid() LIMIT 1;
$$;

-- عزل عام لكل جدول حسب center_id
CREATE POLICY "tenant_isolation_students" ON students
  FOR ALL USING (center_id = (SELECT center_id FROM auth_user_row()));
```

### قواعد RLS المخصصة حسب الدور:
1. **`مالك` (Owner) و`مدير` (Admin)**:
   - قراءة وتعديل كل صفوف `center_id` الخاص بالسنتر.
   - تغيير الباقة، حذف السنتر، تفعيل البصمة البيومترية (`face_templates`)، وإدارة حسابات المالك مقصورة على `role = 'مالك'`.
2. **`محاسب` (Accountant)**:
   - قراءة/كتابة كاملة على `invoices`، `payments`، `discounts`، `expenses`، `settlements`.
   - قراءة فقط على `students`، `teachers`، `groups`.
   - ممنوع من تعديل `users` أو `centers` (باستثناء قوالب الرسائل وتنسيق الإيصال).
3. **`ريسبشن` (Receptionist)**:
   - إنشاء وتعديل `students` و`attendance_records` و`messages` و`payments` (**INSERT فقط** — ممنوع `UPDATE`/`DELETE` على `payments`).
   - ممنوع كلياً من قراءة `expenses`، `settlements`، `discounts`.
4. **`مدرس` (Teacher)**:
   - `groups`: `WHERE teacher_id = auth_user_row().teacher_id`.
   - `students`: فقط الطلاب المسجلين في مجموعات هذا المدرس.
   - `attendance_records` و`assessments`: فقط الحصص/التقييمات التابعة لمجموعاته.
   - `settlements`: فقط تسوياته (`WHERE teacher_id = auth_user_row().teacher_id`) وممنوع من `expenses` ومدفوعات باقي المدرسين.
5. **`ولي أمر` (Parent)**:
   - قراءة فقط (`SELECT`) على `students`، `attendance_records`، `assessments`، `invoices`، `payments` بشرط `student.parent_phone = auth_user_row().phone`.
6. **`activity_log`**:
   - مسموح بـ `INSERT` من الدوال الموثوقة / المستخدمين المصرح لهم، وقراءة مقصورة على `مالك` و`مدير`، مع منع `UPDATE` أو `DELETE` نهائياً (`append-only`).
