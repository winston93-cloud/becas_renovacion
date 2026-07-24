'use client';

/**
 * 2026-07-24 - Shell Control Escolar con atmósfera y nav premium.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ClipboardCheck,
  FilePlus2,
  Home,
  KeyRound,
  LogOut,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui';

const NAV = [
  { href: '/admin', label: 'Inicio', exact: true, icon: Home },
  { href: '/admin/renovaciones', label: 'Renovaciones', icon: RefreshCw },
  { href: '/admin/solicitudes', label: 'Solicitudes', icon: FilePlus2 },
  { href: '/admin/permisos', label: 'Permisos', icon: KeyRound },
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
    <div className="admin-shell">
      <div className="admin-shell-atmosphere" aria-hidden>
        <div className="admin-orb admin-orb--a" />
        <div className="admin-orb admin-orb--b" />
        <div className="home-grain" />
      </div>

      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-header-top">
            <div className="admin-brand-row">
              <div className="admin-brand-mark" aria-hidden>
                <Shield size={20} />
              </div>
              <div className="min-w-0">
                <p className="admin-brand-kicker">
                  Instituto Winston Churchill
                </p>
                <h1 className="admin-brand-title">Control Escolar · Becas</h1>
                {label ? (
                  <span className="admin-level-chip">
                    <ClipboardCheck size={12} aria-hidden />
                    {label}
                  </span>
                ) : null}
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={logout}>
              <span className="inline-flex items-center gap-2">
                <LogOut size={15} aria-hidden />
                Cerrar sesión
              </span>
            </Button>
          </div>

          <nav className="admin-nav" aria-label="Secciones del panel">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'admin-nav-link',
                    active ? 'is-active' : '',
                  ].join(' ')}
                >
                  <Icon size={15} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="admin-main">{children}</main>
    </div>
  );
}
