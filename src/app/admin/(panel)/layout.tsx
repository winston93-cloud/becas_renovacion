import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { readAdminAuth } from '@/lib/admin-auth';
import { AdminShell } from '@/components/admin/AdminShell';

/**
 * 2026-07-24 - Panel autenticado Control Escolar.
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await readAdminAuth();
  if (!admin) redirect('/admin/login');

  return <AdminShell label={admin.label}>{children}</AdminShell>;
}
