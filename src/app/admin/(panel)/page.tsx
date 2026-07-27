'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Clock3,
  FilePlus2,
  Inbox,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Alert, Card } from '@/components/ui';

type Dash = {
  label: string;
  titulo_renovacion?: string;
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
  hint,
  icon: Icon,
  tone = 'default',
  delay = 1,
}: {
  label: string;
  value: number;
  href: string;
  hint: string;
  icon: LucideIcon;
  tone?: 'default' | 'warn' | 'ok' | 'gold';
  delay?: number;
}) {
  return (
    <Link
      href={href}
      className={`admin-stat-card ui-enter-delay-${delay}`}
    >
      <div className="admin-stat-top">
        <p className="admin-stat-label">{label}</p>
        <span
          className={[
            'admin-stat-icon',
            tone === 'warn' ? 'is-warn' : '',
            tone === 'ok' ? 'is-ok' : '',
            tone === 'gold' ? 'is-gold' : '',
          ].join(' ')}
          aria-hidden
        >
          <Icon size={18} />
        </span>
      </div>
      <p className="admin-stat-value">{value}</p>
      <p className="admin-stat-hint">{hint}</p>
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
        <div className="ui-spinner mx-auto mb-3" aria-hidden />
        Cargando resumen…
      </Card>
    );
  }

  if (error || !data) {
    return <Alert variant="error">{error || 'Sin datos.'}</Alert>;
  }

  return (
    <div className="space-y-8">
      <div className="admin-hero">
        <p className="admin-login-kicker" style={{ marginBottom: 0 }}>
          <Sparkles size={14} aria-hidden />
          Panel en vivo
        </p>
        <h2>Resumen · {data.label}</h2>
        <p>
          {data.titulo_renovacion ||
            `Renovación de becas ${data.ciclo_solicitud_label}`}
        </p>
      </div>

      <section>
        <h3 className="admin-section-title">
          <RefreshCw size={14} aria-hidden />
          Renovaciones enviadas
        </h3>
        <div className="admin-stat-grid">
          <Stat
            label="Enviadas"
            value={data.renovaciones.total}
            href="/admin/renovaciones?estado=enviadas"
            hint="Trámites completados por familias"
            icon={Inbox}
            delay={1}
          />
          <Stat
            label="Pendientes verificar"
            value={data.renovaciones.pendientes}
            href="/admin/renovaciones?estado=pendientes"
            hint="Requieren revisión de Control Escolar"
            icon={Clock3}
            tone="warn"
            delay={2}
          />
          <Stat
            label="Verificadas"
            value={data.renovaciones.verificadas}
            href="/admin/renovaciones?estado=verificadas"
            hint="Ya revisadas en el panel"
            icon={BadgeCheck}
            tone="ok"
            delay={3}
          />
          <Stat
            label="Autorizadas"
            value={data.renovaciones.autorizadas}
            href="/admin/renovaciones?estado=autorizadas"
            hint="Beca marcada como autorizada"
            icon={Sparkles}
            tone="gold"
            delay={4}
          />
        </div>
      </section>

      <section>
        <h3 className="admin-section-title">
          <FilePlus2 size={14} aria-hidden />
          Solicitudes nuevas enviadas
        </h3>
        <div className="admin-stat-grid">
          <Stat
            label="Enviadas"
            value={data.solicitudes.total}
            href="/admin/solicitudes?estado=enviadas"
            hint="Primer ingreso / beca nueva"
            icon={Inbox}
            delay={1}
          />
          <Stat
            label="Pendientes verificar"
            value={data.solicitudes.pendientes}
            href="/admin/solicitudes?estado=pendientes"
            hint="En cola de revisión"
            icon={Clock3}
            tone="warn"
            delay={2}
          />
          <Stat
            label="Verificadas"
            value={data.solicitudes.verificadas}
            href="/admin/solicitudes?estado=verificadas"
            hint="Expediente revisado"
            icon={BadgeCheck}
            tone="ok"
            delay={3}
          />
          <Stat
            label="Autorizadas"
            value={data.solicitudes.autorizadas}
            href="/admin/solicitudes?estado=autorizadas"
            hint="Listas para seguimiento"
            icon={Sparkles}
            tone="gold"
            delay={4}
          />
        </div>
      </section>
    </div>
  );
}
