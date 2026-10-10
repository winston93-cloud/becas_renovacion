import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { readAdminAuth } from '@/lib/admin-auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { contarPendientes } from '@/lib/sep/servicio';

/**
 * 2026-07-24 - Panel autenticado Control Escolar.
 * 2026-10-07 - Contador de trámites Beca SEP por validar (aviso en la navegación).
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await readAdminAuth();
  if (!admin) redirect('/admin/login');

  // 2026-10-10 - El conteo ya funciona en producción (InsForge); si falla, el panel sigue cargando.
  const sepPendientes = await contarPendientes(admin).catch(() => 0);

  return (
    <AdminShell label={admin.label} sepPendientes={sepPendientes}>
      {children}
    </AdminShell>
  );
}
