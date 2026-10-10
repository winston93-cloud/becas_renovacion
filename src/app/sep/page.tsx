'use client';

/**
 * 2026-10-07 - Beca SEP (familia): acceso, subida del documento de autorización SEP,
 * resultado de la lectura automática, envío a Control Escolar y seguimiento.
 */
import { ChangeEvent, FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, FileCheck2, Send, Upload } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Alert, Button, Card, Checkbox, Input, Label, Modal } from '@/components/ui';
import {
  AVISO_OTRAS_BECAS,
  MAX_BYTES_DOCUMENTO_SEP,
  MAX_MB_DOCUMENTO_SEP,
  MENSAJE_LIMITE_DOCUMENTO_SEP,
} from '@/lib/sep/tipos';
import {
  fetchConAcceso,
  getAccesoRef,
  getAccesoToken,
  saveAccesoSession,
} from '@/lib/acceso-session';

type DocumentoVista = {
  nombre: string;
  subidoEn: string;
  legible: boolean;
  valido: boolean;
  porcentajeDetectado: number | null;
  nombreDetectado: string | null;
  motivos: string[];
};

type SolicitudVista = {
  id: string;
  estado: 'borrador' | 'enviada' | 'correccion' | 'aplicada' | 'rechazada';
  etiquetaEstado: string;
  intentosFallidos: number;
  maxIntentos: number;
  motivoCorreccion: string | null;
  porcentajeAplicado: number | null;
  enviadaEn: string | null;
  aplicadaEn: string | null;
  puedeEnviar: boolean;
  documento: DocumentoVista | null;
};

type Estado = {
  alumno: { alumno_ref: number; nombre: string; nivel: string | null; grado: number | null };
  ciclo_label: string;
  solicitud: SolicitudVista | null;
  bloqueo?: string | null;
};

type Lectura = { estado: Estado | null; error: string | null };

/** Estado del trámite del alumno de la sesión (sin sesión = null, se muestra el acceso). */
async function leerEstado(): Promise<Lectura> {
  const r = getAccesoRef();
  if (!getAccesoToken() || !r) return { estado: null, error: null };
  try {
    const res = await fetchConAcceso(`/api/sep?alumno_ref=${encodeURIComponent(r)}`);
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) return { estado: null, error: null };
    if (!res.ok) return { estado: null, error: json.error || 'No se pudo consultar el trámite.' };
    return { estado: json as Estado, error: null };
  } catch (e) {
    return { estado: null, error: e instanceof Error ? e.message : 'Error inesperado.' };
  }
}

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
    : '';

export default function BecaSepPage() {
  return (
    <Suspense
      fallback={
        <AppShell titulo="Beca SEP" narrow>
          <p className="text-sm text-text-secondary">Cargando…</p>
        </AppShell>
      }
    >
      <BecaSepInner />
    </Suspense>
  );
}

function BecaSepInner() {
  const sp = useSearchParams();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState(() => (sp.get('alumno_ref') ?? '').replace(/\D/g, ''));
  const [clave, setClave] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // 2026-10-08 - Aviso obligatorio antes de cada subida: la beca SEP sustituye cualquier otra beca.
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const inputArchivo = useRef<HTMLInputElement>(null);
  // 2026-10-09 - Cancelar el aviso descarta el archivo elegido: así queda claro que no se subió nada.
  const cerrarAviso = useCallback(() => {
    setAvisoAbierto(false);
    setArchivo(null);
    if (inputArchivo.current) inputArchivo.current.value = '';
  }, []);

  const aplicarLectura = useCallback((r: Lectura) => {
    setEstado(r.estado);
    if (r.error) setError(r.error);
    else if (r.estado) setError(null);
    setCargando(false);
  }, []);

  const cargar = useCallback(async () => aplicarLectura(await leerEstado()), [aplicarLectura]);

  useEffect(() => {
    let vigente = true;
    leerEstado().then((r) => {
      if (vigente) aplicarLectura(r);
    });
    return () => {
      vigente = false;
    };
  }, [aplicarLectura]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEntrando(true);
    try {
      const res = await fetch('/api/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumno_ref: ref.trim(), alumno_clave: clave }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.token) throw new Error(json.error || 'Número de control o contraseña incorrectos.');
      saveAccesoSession(String(json.token), ref.trim());
      setClave('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setEntrando(false);
    }
  }

  /** 2026-10-09 - Sin botón "Subir y revisar": al elegir el archivo se abre el aviso y, al aceptarlo, se sube. */
  function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0] ?? null;
    if (!elegido) return;
    if (elegido.size > MAX_BYTES_DOCUMENTO_SEP) {
      setError(MENSAJE_LIMITE_DOCUMENTO_SEP);
      setArchivo(null);
      e.target.value = '';
      return;
    }
    setError(null);
    setArchivo(elegido);
    setAceptaAviso(false);
    setAvisoAbierto(true);
  }

  async function subir() {
    if (!archivo || !aceptaAviso) return;
    setAvisoAbierto(false);
    setError(null);
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', archivo);
      fd.append('acepta_aviso', '1');
      const res = await fetchConAcceso('/api/sep/documento', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'No se pudo subir el documento.');
      setEstado((prev) => (prev ? { ...prev, solicitud: json.solicitud } : prev));
      setArchivo(null);
      if (inputArchivo.current) inputArchivo.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setSubiendo(false);
    }
  }

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const res = await fetchConAcceso('/api/sep/enviar', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar.');
      setEstado((prev) => (prev ? { ...prev, solicitud: json.solicitud } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <AppShell titulo="Beca SEP" narrow>
        <p className="text-sm text-text-secondary">Cargando…</p>
      </AppShell>
    );
  }

  if (!estado) {
    return (
      <AppShell titulo="Beca SEP" narrow>
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al portal de becas
        </Link>
        <Card>
          <h1 className="font-display text-2xl font-semibold">Beca SEP</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Si la SEP le otorgó beca a su hijo(a), ingrese con el número de control y la
            contraseña del alumno para subir el documento de autorización.
          </p>
          <form onSubmit={entrar} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="sep_ref" required>No. de Control</Label>
              <Input
                id="sep_ref"
                inputMode="numeric"
                autoComplete="username"
                value={ref}
                onChange={(e) => setRef(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 12345"
              />
            </div>
            <div>
              <Label htmlFor="sep_clave" required>Contraseña</Label>
              <Input
                id="sep_clave"
                type="password"
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Contraseña del alumno"
              />
            </div>
            {error ? <Alert variant="warning">{error}</Alert> : null}
            <Button type="submit" fullWidth disabled={!ref || !clave || entrando}>
              {entrando ? 'Verificando…' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </AppShell>
    );
  }

  const s = estado.solicitud;
  const doc = s?.documento ?? null;
  // 2026-10-09 - Alumno inactivo o sin inscripción en el ciclo: no puede subir ni enviar.
  const bloqueo = estado.bloqueo ?? null;
  const puedeSubir = !bloqueo && (!s || s.estado === 'borrador' || s.estado === 'correccion');
  const agotoIntentos = !!s && s.intentosFallidos >= s.maxIntentos;

  return (
    <AppShell
      titulo="Beca SEP"
      alumnoNombre={estado.alumno.nombre}
      alumnoRef={String(estado.alumno.alumno_ref)}
      cicloLabel={estado.ciclo_label}
      narrow
    >
      <div className="space-y-5">
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-1 rounded-full bg-primary-light p-2 text-primary" aria-hidden>
              <FileCheck2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">Documento de autorización SEP</h1>
              <p className="mt-1 text-sm text-text-secondary">
                {estado.alumno.nombre}
                {estado.alumno.nivel ? ` · ${estado.alumno.nivel}` : ''}
                {estado.alumno.grado ? ` ${estado.alumno.grado}°` : ''} · Ciclo {estado.ciclo_label}
              </p>
            </div>
          </div>

          {s ? (
            <p className="mt-4 text-sm">
              Estado: <strong>{s.etiquetaEstado}</strong>
            </p>
          ) : null}
        </Card>

        {bloqueo && s?.estado !== 'aplicada' ? (
          <Alert variant="warning" title="No puede tramitar la Beca SEP">
            {bloqueo}
          </Alert>
        ) : null}

        {!bloqueo && s?.estado === 'enviada' ? (
          <Alert variant="info" title="En revisión de Control Escolar">
            Se envió el {fecha(s.enviadaEn)}. Control Escolar revisará el documento y
            aplicará la beca. No necesita mandar nada por correo.
          </Alert>
        ) : null}

        {s?.estado === 'aplicada' ? (
          <Alert variant="success" title="Beca SEP aplicada">
            Control Escolar aplicó la beca SEP del <strong>{s.porcentajeAplicado} %</strong> el{' '}
            {fecha(s.aplicadaEn)}. El ajuste de sus mensualidades lo verá reflejado en Servicios
            Administrativos.
          </Alert>
        ) : null}

        {s?.estado === 'rechazada' ? (
          <Alert variant="warning" title="Trámite rechazado">
            Comuníquese con Control Escolar.
          </Alert>
        ) : null}

        {s?.estado === 'correccion' && s.motivoCorreccion ? (
          <Alert variant="warning" title="Control Escolar le pide corregir el documento">
            {s.motivoCorreccion}
          </Alert>
        ) : null}

        {doc && puedeSubir ? (
          <Card>
            <h2 className="text-lg font-semibold">Resultado de la revisión automática</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Archivo: {doc.nombre} · {fecha(doc.subidoEn)}
            </p>
            <div className="mt-4">
              {doc.valido ? (
                <Alert variant="success" title="Documento reconocido">
                  Alumno: <strong>{doc.nombreDetectado}</strong>. Beca autorizada:{' '}
                  <strong>{doc.porcentajeDetectado} %</strong>. Ya puede enviarlo a Control Escolar.
                </Alert>
              ) : !doc.legible ? (
                <Alert variant="info" title="No se pudo leer automáticamente">
                  <ul className="list-disc pl-5">
                    {doc.motivos.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </Alert>
              ) : (
                <Alert variant="warning" title="El documento no se pudo validar">
                  <ul className="list-disc pl-5">
                    {doc.motivos.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                  <p className="mt-2">
                    {agotoIntentos
                      ? 'Comuníquese con Control Escolar. El documento debe quedar subido aquí (no por correo); puede enviarlo para que lo revisen a mano.'
                      : `Vuelva a subir el documento correcto (intento ${s?.intentosFallidos} de ${s?.maxIntentos}).`}
                  </p>
                </Alert>
              )}
            </div>
          </Card>
        ) : null}

        {puedeSubir ? (
          <Card>
            <h2 className="text-lg font-semibold">{doc ? 'Subir otro documento' : 'Subir documento'}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              El documento que le entregó la SEP con el nombre del alumno y el porcentaje de beca
              autorizado. PDF, JPG o PNG de <strong>máximo {MAX_MB_DOCUMENTO_SEP} MB</strong>; no se reciben
              archivos más pesados.
            </p>
            {/* 2026-10-08 - Consejo para fotos: es lo que más ayuda a que el OCR lea el documento. */}
            <p className="mt-1 text-xs text-text-secondary">
              Si toma foto: de frente, con buena luz, sin sombras y que se vea la hoja completa.
            </p>
            {/* 2026-10-09 - Un solo paso: elegir el archivo lo sube (tras aceptar el aviso). */}
            <input
              ref={inputArchivo}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={elegirArchivo}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => inputArchivo.current?.click()} disabled={subiendo || enviando}>
                <Upload className="h-4 w-4" aria-hidden />
                {subiendo
                  ? `Subiendo y revisando ${archivo?.name ?? 'documento'}…`
                  : doc
                    ? 'Elegir y subir otro documento'
                    : 'Elegir y subir documento'}
              </Button>
              {s?.puedeEnviar ? (
                <Button variant="secondary" onClick={enviar} disabled={enviando || subiendo}>
                  <Send className="h-4 w-4" aria-hidden />
                  {enviando ? 'Enviando…' : 'Enviar a Control Escolar'}
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {error ? <Alert variant="error">{error}</Alert> : null}
      </div>

      <Modal
        open={avisoAbierto}
        onClose={cerrarAviso}
        tone="warning"
        icon={<AlertTriangle className="h-5 w-5" />}
        eyebrow="Antes de subir el documento"
        title="¿Está seguro de cambiar a la beca SEP?"
        secondaryLabel="Cancelar"
        primaryLabel="Sí, subir documento"
        onPrimary={subir}
        primaryDisabled={!aceptaAviso}
      >
        <div className="space-y-3 text-sm">
          <p>
            Al agregar la beca SEP, <strong>{estado.alumno.nombre}</strong> perderá el beneficio de{' '}
            <strong>cualquier otra beca</strong> que tenga actualmente en el colegio. Las becas no se suman.
          </p>
          {/* 2026-10-09 - La beca que se pierde no se renueva: la familia tendría que solicitarla otra vez. */}
          <p>
            Además, la beca que pierda <strong>no se renovará</strong> el próximo ciclo escolar: si la quiere de nuevo,
            deberá solicitarla otra vez como solicitud nueva.
          </p>
          <p className="text-text-secondary">Si tiene dudas, comuníquese con Control Escolar antes de continuar.</p>
          <Checkbox
            id="sep_acepta_aviso"
            checked={aceptaAviso}
            onChange={(e) => setAceptaAviso(e.target.checked)}
            label={AVISO_OTRAS_BECAS}
          />
        </div>
      </Modal>
    </AppShell>
  );
}
