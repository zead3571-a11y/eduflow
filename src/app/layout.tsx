import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EDUFLOW | Tutoring Center Management',
  description: 'Manage students, classes, attendance and payments.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
