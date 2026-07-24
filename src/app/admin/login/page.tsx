'use client';

/**
 * 2026-07-24 - Login Control Escolar (estilo AgendaW: nivel + clave).
 */
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Input, Label } from '@/components/ui';
import { ADMIN_ROLES, type AdminRole } from '@/lib/admin-roles';

const ROLES = Object.entries(ADMIN_ROLES).map(([value, meta]) => ({
  value: value as AdminRole,
  label: meta.label,
}));

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
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
          Instituto Winston Churchill
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-primary">
          Control Escolar
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Elige tu nivel e ingresa la clave de acceso
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label>Nivel</Label>
          <div className="mt-2 grid gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setRole(r.value);
                  setError(null);
                }}
                className={[
                  'rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                  role === r.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-bg text-primary hover:border-primary/40',
                ].join(' ')}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="admin-pin">Clave de acceso</Label>
          <Input
            id="admin-pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••••••"
            autoComplete="current-password"
            disabled={!role}
            className="mt-2"
          />
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !role || !pin}
        >
          {loading ? 'Verificando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-border bg-card p-8 text-sm text-text-secondary">
            Cargando…
          </div>
        }
      >
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
