'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Card } from '@/components/ui';

type Dash = {
  label: string;
  ciclo_renovacion_label: string;
  ciclo_solicitud_label: string;
  renovaciones: {
    total: number;
    pendientes: number;
    verificadas: number;
    autorizadas: number;
  };
  solicitudes: {
    total: number;
    pendientes: number;
    verificadas: number;
    autorizadas: number;
  };
};

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-bg p-4 transition hover:border-primary/30"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-primary">
        {value}
      </p>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/dashboard');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'No se pudo cargar.');
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="text-center text-sm text-text-secondary">
        Cargando resumen…
      </Card>
    );
  }

  if (error || !data) {
    return <Alert variant="error">{error || 'Sin datos.'}</Alert>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-primary">
          Resumen · {data.label}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Renovaciones ciclo {data.ciclo_renovacion_label} · Solicitudes ciclo{' '}
          {data.ciclo_solicitud_label}
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-primary">
          Renovaciones enviadas
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Enviadas"
            value={data.renovaciones.total}
            href="/admin/renovaciones?estado=enviadas"
          />
          <Stat
            label="Pendientes verificar"
            value={data.renovaciones.pendientes}
            href="/admin/renovaciones?estado=pendientes"
          />
          <Stat
            label="Verificadas"
            value={data.renovaciones.verificadas}
            href="/admin/renovaciones?estado=verificadas"
          />
          <Stat
            label="Autorizadas"
            value={data.renovaciones.autorizadas}
            href="/admin/renovaciones?estado=autorizadas"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-primary">
          Solicitudes nuevas enviadas
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Enviadas"
            value={data.solicitudes.total}
            href="/admin/solicitudes?estado=enviadas"
          />
          <Stat
            label="Pendientes verificar"
            value={data.solicitudes.pendientes}
            href="/admin/solicitudes?estado=pendientes"
          />
          <Stat
            label="Verificadas"
            value={data.solicitudes.verificadas}
            href="/admin/solicitudes?estado=verificadas"
          />
          <Stat
            label="Autorizadas"
            value={data.solicitudes.autorizadas}
            href="/admin/solicitudes?estado=autorizadas"
          />
        </div>
      </section>
    </div>
  );
}
