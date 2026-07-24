'use client';

/**
 * 2026-07-24 - Shell del panel Control Escolar (nav + logout).
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';

const NAV = [
  { href: '/admin', label: 'Inicio', exact: true },
  { href: '/admin/renovaciones', label: 'Renovaciones' },
  { href: '/admin/solicitudes', label: 'Solicitudes' },
  { href: '/admin/permisos', label: 'Permisos' },
];

type Props = {
  children: ReactNode;
  label?: string;
};

export function AdminShell({ children, label }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Instituto Winston Churchill
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-xl text-primary">
              Control Escolar · Becas
            </h1>
            {label ? (
              <p className="mt-0.5 text-sm text-text-secondary">{label}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-bg hover:text-primary',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
