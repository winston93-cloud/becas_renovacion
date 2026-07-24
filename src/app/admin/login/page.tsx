'use client';

/**
 * 2026-07-24 - Login Control Escolar con atmósfera editorial Winston.
 */
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Baby, GraduationCap, KeyRound, School, ShieldCheck } from 'lucide-react';
import { Alert, Button, Input, Label } from '@/components/ui';
import { ADMIN_ROLES, type AdminRole } from '@/lib/admin-roles';

const ROLE_META: Record<
  AdminRole,
  { label: string; hint: string; icon: typeof Baby }
> = {
  ce_mk: {
    label: ADMIN_ROLES.ce_mk.label,
    hint: 'Niveles 1 y 2',
    icon: Baby,
  },
  ce_pri: {
    label: ADMIN_ROLES.ce_pri.label,
    hint: 'Nivel 3',
    icon: School,
  },
  ce_sec: {
    label: ADMIN_ROLES.ce_sec.label,
    hint: 'Nivel 4',
    icon: GraduationCap,
  },
};

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<AdminRole | ''>('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, pin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Acceso denegado.');
        return;
      }
      const next = searchParams.get('next') || '/admin';
      router.push(next);
      router.refresh();
    } catch {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-card">
      <p className="admin-login-kicker">
        <ShieldCheck size={14} aria-hidden />
        Acceso staff
      </p>
      <h1 className="admin-login-title">Control Escolar</h1>
      <p className="admin-login-lead">
        Panel de becas Winston. Elige tu nivel e ingresa la clave asignada.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-5">
        <div>
          <Label>Nivel escolar</Label>
          <div className="admin-role-grid mt-2">
            {(Object.keys(ROLE_META) as AdminRole[]).map((value, i) => {
              const meta = ROLE_META[value];
              const Icon = meta.icon;
              return (
                <button
                  key={value}
                  type="button"
                  className={[
                    'admin-role-btn',
                    role === value ? 'is-active' : '',
                    `ui-enter ui-enter-delay-${i + 1}`,
                  ].join(' ')}
                  onClick={() => {
                    setRole(value);
                    setError(null);
                  }}
                >
                  <span className="admin-role-icon" aria-hidden>
                    <Icon size={18} />
                  </span>
                  <span className="admin-role-copy">
                    <strong>{meta.label}</strong>
                    <span>{meta.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ui-enter ui-enter-delay-4">
          <Label htmlFor="admin-pin">Clave de acceso</Label>
          <div className="relative mt-2">
            <KeyRound
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-secondary"
              aria-hidden
            />
            <Input
              id="admin-pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              disabled={!role}
              className="pl-10"
            />
          </div>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <Button
          type="submit"
          className="w-full min-h-12"
          disabled={loading || !role || !pin}
        >
          {loading ? 'Verificando…' : 'Entrar al panel'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-text-secondary">
        Instituto Winston Churchill · Solo personal autorizado
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="admin-login-page">
      <div className="home-atmosphere" aria-hidden>
        <div className="home-orb home-orb--a" />
        <div className="home-orb home-orb--b" />
        <div className="home-orb home-orb--c" />
        <div className="home-grain" />
      </div>
      <Suspense
        fallback={
          <div className="admin-login-card text-sm text-text-secondary">
            Cargando…
          </div>
        }
      >
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
