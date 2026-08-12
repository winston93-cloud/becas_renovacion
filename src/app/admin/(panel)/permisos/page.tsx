'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Label } from '@/components/ui';

type Item = {
  alumno_id: number;
  alumno_ref: string;
  nombre: string;
  nivel_label: string;
  grado: number | null;
  grupo: string;
  permiso_solicitud: boolean;
  acceso_enviada: boolean;
};

type EmailAvisoConfig = {
  from: string;
  to: string;
  bcc: string | null;
};

export default function AdminPermisosPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [emailAviso, setEmailAviso] = useState<EmailAvisoConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);

  const load = useCallback(async (query: string) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(
        `/api/admin/permisos-solicitud?${params.toString()}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      if (seq !== reqSeq.current) return;
      setItems(json.items || []);
      if (json.email_aviso?.to) {
        setEmailAviso({
          from: String(json.email_aviso.from || ''),
          to: String(json.email_aviso.to),
          bcc: json.email_aviso.bcc ? String(json.email_aviso.bcc) : null,
        });
      }
    } catch (err) {
      if (seq !== reqSeq.current) return;
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  // Carga inicial + búsqueda dinámica (debounce), sin botón Buscar.
  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(q);
    }, q.trim() ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [q, load]);

  async function setPermiso(alumnoId: number, permiso: boolean) {
    setBusyId(alumnoId);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/admin/permisos-solicitud', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumno_id: alumnoId,
          permiso_solicitud: permiso,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');
      if (permiso && json.email_aviso?.ok) {
        setOkMsg(
          `Acceso autorizado. Se envió el aviso oficial a ${json.email_aviso.to || 'la familia'}.`
        );
      } else if (permiso && json.email_aviso && !json.email_aviso.ok) {
        setOkMsg(
          `Acceso autorizado, pero el correo no se pudo enviar: ${json.email_aviso.error || 'error SMTP'}.`
        );
      } else if (permiso) {
        setOkMsg('Acceso autorizado.');
      } else {
        setOkMsg('Permiso revocado.');
      }
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="admin-hero">
        <h2>Permisos de solicitud</h2>
        <p>
          Aquí aparecen los pedidos de acceso del correo «Solicitud de acceso a
          beca». Autoriza al alumno para que pueda llenar el formulario; la
          solicitud enviada se ve después en la pestaña Solicitudes.
        </p>
      </div>

      {emailAviso ? (
        <Alert variant="info" title="Aviso de acceso autorizado">
          Al autorizar, el Instituto envía un correo oficial desde{' '}
          <strong>{emailAviso.from || 'avisos_no-replay@winston93.edu.mx'}</strong>
          {' '}hacia <strong>{emailAviso.to}</strong>
          {emailAviso.bcc ? (
            <>
              {' '}
              (copia oculta BCC: <strong>{emailAviso.bcc}</strong>)
            </>
          ) : null}
          , indicando que ya puede ingresar al portal a solicitar la beca.
        </Alert>
      ) : null}

      <div className="w-full max-w-md">
        <Label htmlFor="q">Buscar No. Control o nombre</Label>
        <div className="relative mt-1">
          <Input
            ref={inputRef}
            id="q"
            type="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escriba para filtrar…"
            className="min-h-[44px] pr-9"
            aria-label="Buscar alumno por número de control o nombre"
          />
          {q ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:text-primary"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setQ('');
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}
      {loading ? (
        <Card className="text-sm text-text-secondary">Cargando…</Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card className="text-sm text-text-secondary">
          No hay alumnos con pedido de acceso o permiso en tu nivel. Usa la
          búsqueda por No. de Control.
        </Card>
      ) : null}

      <div className="space-y-2">
        {items.map((it) => (
          <Card
            key={it.alumno_id}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-primary">{it.nombre}</p>
              <p className="text-sm text-text-secondary">
                {it.alumno_ref} · {it.nivel_label} {it.grado ?? '—'} /{' '}
                {it.grupo}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {it.acceso_enviada ? (
                  <Badge variant="pending">Pidió acceso</Badge>
                ) : null}
                {it.permiso_solicitud ? (
                  <Badge variant="success">Autorizado</Badge>
                ) : (
                  <Badge>Sin permiso</Badge>
                )}
              </div>
              {emailAviso && it.acceso_enviada && !it.permiso_solicitud ? (
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  Al autorizar, el aviso de acceso se enviará a:{' '}
                  <span className="font-semibold text-primary">
                    {emailAviso.to}
                  </span>
                  {emailAviso.bcc ? (
                    <>
                      {' '}
                      · BCC:{' '}
                      <span className="font-semibold text-primary">
                        {emailAviso.bcc}
                      </span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant={it.permiso_solicitud ? 'secondary' : 'primary'}
              className="min-h-[44px] shrink-0"
              disabled={
                busyId === it.alumno_id ||
                (!it.permiso_solicitud && !it.acceso_enviada)
              }
              title={
                !it.permiso_solicitud && !it.acceso_enviada
                  ? 'Solo se autoriza si la familia ya pidió acceso'
                  : undefined
              }
              onClick={() =>
                setPermiso(it.alumno_id, !it.permiso_solicitud)
              }
            >
              {it.permiso_solicitud ? 'Revocar' : 'Autorizar solicitud'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
