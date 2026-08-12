'use client';

/**
 * 2026-07-16 - Home: acceso por No. de Control.
 * 2026-07-17 - Solicitud: pedir acceso / esperar / continuar con permiso.
 * 2026-07-17 - Renovación: validar beca del ciclo anterior ANTES de salir del home.
 * 2026-07-28 - Modal Renovación solo si hubo beca activa el ciclo pasado
 *              (historial antepasado → puede Solicitud nueva).
 * 2026-07-18 - Radios nativos fiables en móvil.
 * 2026-07-22 - Requiere No. de Control + contraseña (alumno_clave), como el legacy.
 * 2026-07-22 - Ventanas de fechas: validar antes de cualquier petición.
 * 2026-07-23 - Home editorial: marca Winston primero + panel de acceso.
 */
import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  FileText,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Alert, Button, Input, Label, Modal } from '@/components/ui';
import {
  fetchConAcceso,
  saveAccesoSession,
} from '@/lib/acceso-session';
import {
  APERTURA_PORTAL,
  CIERRE_RENOVACION,
  HORA_APERTURA_CDMX,
  formatPortalFechaEs,
  getPortalStatus,
} from '@/lib/portal-ventanas';type Flujo = 'renovacion' | 'solicitud';

type AccesoEstado =
  | 'puede_solicitar'
  | 'esperando_respuesta'
  | 'autorizado'
  | 'ya_tiene_beca'
  | 'no_encontrado';

type DocRequeridoUi = { tipo: string; label: string };

export default function HomePage() {
  const router = useRouter();
  const [alumnoRef, setAlumnoRef] = useState('');
  const [alumnoClave, setAlumnoClave] = useState('');
  const [flujo, setFlujo] = useState<Flujo>('renovacion');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [docsAcceso, setDocsAcceso] = useState<{
    nivelLabel: string;
    docs: DocRequeridoUi[];
  } | null>(null);
  const [modalRenovacion, setModalRenovacion] = useState(false);
  const [modalVentana, setModalVentana] = useState<{
    titulo: string;
    mensaje: string;
    codigo?: string;
  } | null>(null);

  function assertVentanaAbierta(flujoCheck: Flujo): boolean {
    const status = getPortalStatus(flujoCheck);
    if (status.open) return true;
    setModalVentana({
      titulo: status.titulo,
      mensaje: status.mensaje,
      codigo: status.codigo,
    });
    return false;
  }

  function tomarDocsDeRespuesta(json: Record<string, unknown>) {
    const docs = Array.isArray(json.documentos_requeridos)
      ? (json.documentos_requeridos as DocRequeridoUi[]).filter(
          (d) => d && typeof d.label === 'string'
        )
      : [];
    if (docs.length === 0) {
      setDocsAcceso(null);
      return;
    }
    setDocsAcceso({
      nivelLabel:
        typeof json.nivel_label === 'string' && json.nivel_label
          ? json.nivel_label
          : 'su nivel',
      docs,
    });
  }

  function limpiarFeedback() {
    setError(null);
    setInfo(null);
    setDocsAcceso(null);
    setModalRenovacion(false);
  }

  async function iniciarSesion(ref: string, clave: string): Promise<void> {
    const res = await fetch('/api/acceso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alumno_ref: ref, alumno_clave: clave }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.token) {
      throw new Error(
        json.error || 'Número de control o contraseña incorrectos.'
      );
    }
    saveAccesoSession(String(json.token), ref);
  }

  async function validarRenovacion(ref: string): Promise<boolean> {
    const res = await fetchConAcceso(
      `/api/renovacion?alumno_ref=${encodeURIComponent(ref)}`
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        json.error ||
          'No se pudo verificar si este alumno puede renovar su beca.'
      );
    }
    return true;
  }

  async function irARenovacion() {
    const ref = alumnoRef.trim();
    const clave = alumnoClave;
    if (!ref || !clave) return;
    if (!assertVentanaAbierta('renovacion')) return;
    setModalRenovacion(false);
    setFlujo('renovacion');
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await iniciarSesion(ref, clave);
      await validarRenovacion(ref);
      router.push(`/renovacion?alumno_ref=${encodeURIComponent(ref)}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ref = alumnoRef.trim();
    const clave = alumnoClave;
    if (!ref || !clave) return;

    if (!assertVentanaAbierta(flujo)) return;

    setError(null);
    setInfo(null);
    setDocsAcceso(null);
    setModalRenovacion(false);
    setLoading(true);

    try {
      await iniciarSesion(ref, clave);

      if (flujo === 'renovacion') {
        await validarRenovacion(ref);
        router.push(`/renovacion?alumno_ref=${encodeURIComponent(ref)}`);
        return;
      }

      const statusRes = await fetchConAcceso(
        `/api/solicitud/acceso?alumno_ref=${encodeURIComponent(ref)}`
      );
      const statusJson = await statusRes.json().catch(() => ({}));

      if (!statusRes.ok) {
        if (
          statusJson.estado === 'ya_tiene_beca' ||
          statusJson.codigo === 'YA_TIENE_BECA'
        ) {
          setModalRenovacion(true);
          return;
        }
        throw new Error(
          statusJson.error || 'No se pudo verificar el número de control.'
        );
      }

      const estado = statusJson.estado as AccesoEstado;

      if (estado === 'ya_tiene_beca') {
        setModalRenovacion(true);
        return;
      }

      if (estado === 'autorizado') {
        router.push(`/solicitud?alumno_ref=${encodeURIComponent(ref)}`);
        return;
      }

      if (estado === 'esperando_respuesta') {
        tomarDocsDeRespuesta(statusJson);
        setInfo(
          statusJson.mensaje ||
            'Ya envió su solicitud de acceso. Por favor espere la respuesta del área de becas del Instituto.'
        );
        return;
      }

      if (estado === 'puede_solicitar') {
        const postRes = await fetchConAcceso('/api/solicitud/acceso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alumno_ref: ref }),
        });
        const postJson = await postRes.json().catch(() => ({}));
        if (
          postJson.estado === 'ya_tiene_beca' ||
          postJson.codigo === 'YA_TIENE_BECA'
        ) {
          setModalRenovacion(true);
          return;
        }
        if (!postRes.ok) {
          throw new Error(
            postJson.error || 'No se pudo enviar la solicitud de acceso.'
          );
        }
        if (postJson.puede_continuar) {
          router.push(`/solicitud?alumno_ref=${encodeURIComponent(ref)}`);
          return;
        }
        tomarDocsDeRespuesta(postJson);
        setInfo(
          postJson.mensaje ||
            'Solicitud de acceso enviada. Espere la respuesta del área de becas del Instituto.'
        );
        return;
      }

      setError(statusJson.mensaje || 'No se pudo continuar con el trámite.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado.'
      );
    } finally {
      setLoading(false);
    }
  }

  function elegirFlujo(next: Flujo) {
    setFlujo(next);
    limpiarFeedback();
  }

  const puedeEnviar = Boolean(alumnoRef.trim() && alumnoClave && !loading && !info);

  return (
    <div className="home-shell">
      <div className="home-atmosphere" aria-hidden>
        <span className="home-orb home-orb--a" />
        <span className="home-orb home-orb--b" />
        <span className="home-orb home-orb--c" />
        <span className="home-grain" />
      </div>

      <header className="home-top ui-enter">
        <div className="home-brand-mark">
          <p className="home-brand-kicker">Instituto Winston Churchill</p>
          <p className="home-brand-name">Winston</p>
        </div>
        <span className="home-chip">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Acceso familiar
        </span>
      </header>

      <main className="home-main">
        <section className="home-hero ui-enter ui-enter-delay-1">
          <p className="home-brand-kicker">Programa de becas</p>
          <h1 className="home-hero-title">
            Winston
            <span>Portal de becas</span>
          </h1>
          <p className="home-hero-lead">
            Renueva o solicita beca con claridad: número de control, contraseña
            escolar y el trámite que corresponda.
          </p>
          <div className="home-hero-meta">
            <span className="home-chip">Renovación</span>
            <span className="home-chip">Solicitud nueva</span>
            <span className="home-chip">Documentos en línea</span>
          </div>
          <figure className="home-photo">
            <Image
              src="/images/winston-comunidad.jpg"
              alt="Comunidad estudiantil Winston"
              width={640}
              height={400}
              className="home-photo-img"
              sizes="(max-width: 899px) 100vw, 440px"
              priority
            />
          </figure>
        </section>

        <section className="home-panel ui-enter ui-enter-delay-2">
          <h2 className="home-panel-title">Ingresar al trámite</h2>
          <p className="home-panel-sub">
            Elige el tipo de solicitud e inicia con los datos del alumno.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p
                className="mb-1.5 block text-sm font-semibold text-text"
                id="flujo-label"
              >
                Tipo de trámite
              </p>
              <div
                className="mt-3 grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-labelledby="flujo-label"
              >
                <label
                  className={`home-flow-card${flujo === 'renovacion' ? ' is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="flujo"
                    value="renovacion"
                    checked={flujo === 'renovacion'}
                    onChange={() => elegirFlujo('renovacion')}
                    aria-label="Renovación"
                  />
                  <span className="home-flow-icon" aria-hidden>
                    <RefreshCw className="h-4 w-4" />
                  </span>
                  <span className="relative z-[1]">
                    <span className="block text-base font-semibold text-text">
                      Renovación
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-text-secondary">
                      Beca del ciclo pasado
                    </span>
                  </span>
                </label>

                <label
                  className={`home-flow-card${flujo === 'solicitud' ? ' is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="flujo"
                    value="solicitud"
                    checked={flujo === 'solicitud'}
                    onChange={() => elegirFlujo('solicitud')}
                    aria-label="Solicitud nueva"
                  />
                  <span className="home-flow-icon" aria-hidden>
                    <UserPlus className="h-4 w-4" />
                  </span>
                  <span className="relative z-[1]">
                    <span className="block text-base font-semibold text-text">
                      Solicitud nueva
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-text-secondary">
                      Sin beca el ciclo pasado
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="alumno_ref" required>
                No. de Control
              </Label>
              <Input
                id="alumno_ref"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="username"
                value={alumnoRef}
                onChange={(e) => {
                  setAlumnoRef(e.target.value.replace(/\D/g, ''));
                  limpiarFeedback();
                }}
                placeholder="Ej. 21628"
                aria-label="Número de control del alumno"
              />
            </div>

            <div>
              <Label htmlFor="alumno_clave" required>
                Contraseña
              </Label>
              <Input
                id="alumno_clave"
                type="password"
                autoComplete="current-password"
                value={alumnoClave}
                onChange={(e) => {
                  setAlumnoClave(e.target.value);
                  limpiarFeedback();
                }}
                placeholder="Contraseña del alumno"
                aria-label="Contraseña del alumno"
              />
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {flujo === 'solicitud'
                  ? 'Misma contraseña del sistema escolar. Primero se solicita acceso; al autorizarlo, continúa el formulario.'
                  : 'Misma contraseña del sistema escolar. Para alumnos con beca del ciclo anterior lista para renovar.'}
              </p>
            </div>

            {error ? (
              <Alert variant="warning" title="No se pudo continuar">
                <p className="leading-relaxed">{error}</p>
                <p className="mt-2 text-xs opacity-80">
                  Verifica el número de control y la contraseña e inténtalo de
                  nuevo.
                </p>
              </Alert>
            ) : null}

            {info ? (
              <Alert variant="info" title="Solicitud de acceso">
                {info}
              </Alert>
            ) : null}

            {info && docsAcceso ? (
              <aside className="home-docs-card ui-enter" aria-label="Documentos para el trámite">
                <div className="home-docs-card__head">
                  <span className="home-docs-card__icon" aria-hidden>
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="home-docs-card__kicker">Prepare su expediente</p>
                    <h3 className="home-docs-card__title">
                      Documentos para solicitud de beca
                    </h3>
                    <p className="home-docs-card__sub">
                      Según el nivel ({docsAcceso.nivelLabel}). Cuando le
                      autoricen el acceso, deberá subirlos en PDF en el portal.
                    </p>
                  </div>
                </div>
                <ol className="home-docs-list">
                  {docsAcceso.docs.map((doc, idx) => (
                    <li key={doc.tipo} className="home-docs-list__item">
                      <span className="home-docs-list__num" aria-hidden>
                        {idx + 1}
                      </span>
                      <span className="home-docs-list__label">{doc.label}</span>
                    </li>
                  ))}
                </ol>
                <p className="home-docs-card__note">
                  Solo archivos PDF, legibles y a nombre del alumno o tutor
                  correspondiente.
                </p>
              </aside>
            ) : null}

            <Button type="submit" disabled={!puedeEnviar} fullWidth>
              {loading
                ? 'Verificando…'
                : flujo === 'renovacion'
                  ? 'Continuar'
                  : info
                    ? 'Esperando respuesta'
                    : 'Solicitar acceso'}
              {!loading && flujo === 'renovacion' ? (
                <ArrowRight className="h-4 w-4" aria-hidden />
              ) : null}
              {!loading && flujo === 'solicitud' && !info ? (
                <UserPlus className="h-4 w-4" aria-hidden />
              ) : null}
            </Button>

            {flujo === 'solicitud' ? (
              <p className="text-center text-xs leading-relaxed text-text-secondary">
                Si ya le autorizaron el acceso, el mismo botón lo lleva al
                formulario.
              </p>
            ) : null}
          </form>
        </section>
      </main>

      <footer className="home-footer ui-enter ui-enter-delay-3">
        <span>Instituto Winston Churchill · Sistema de Becas</span>
        <span>Portal de Becas v0.1.0</span>
      </footer>

      <Modal
        open={Boolean(modalVentana)}
        title={modalVentana?.titulo || 'Portal cerrado'}
        onClose={() => setModalVentana(null)}
        secondaryLabel="Entendido"
        tone={
          modalVentana?.codigo === 'RENOVACION_CERRADA' ? 'warning' : 'notice'
        }
        eyebrow="Aviso del portal"
        icon={<CalendarClock className="h-5 w-5" strokeWidth={2.25} />}
      >
        {modalVentana?.codigo === 'PORTAL_CERRADO' ? (
          <>
            <p>
              El trámite aún no está disponible. El Portal de Becas abre en la
              fecha y hora indicadas (hora de la CDMX).
            </p>
            <div className="ui-modal-date-card">
              <p className="ui-modal-date-label">Apertura</p>
              <p className="ui-modal-date-value">
                {formatPortalFechaEs(APERTURA_PORTAL)}
              </p>
              <p className="ui-modal-date-time">
                a las {String(HORA_APERTURA_CDMX).padStart(2, '0')}:00 a.m. ·
                hora de la CDMX
              </p>
            </div>
            <p className="ui-modal-hint">
              Vuelva a intentarlo a partir de ese momento. Mientras tanto puede
              preparar documentos y datos del alumno.
            </p>
          </>
        ) : modalVentana?.codigo === 'RENOVACION_CERRADA' ? (
          <>
            <p>{modalVentana?.mensaje}</p>
            <div className="ui-modal-date-card">
              <p className="ui-modal-date-label">Cierre de renovación</p>
              <p className="ui-modal-date-value">
                {formatPortalFechaEs(CIERRE_RENOVACION)}
              </p>
            </div>
            <p className="ui-modal-hint">
              Para orientación, acuda al área de becas del Instituto.
            </p>
          </>
        ) : (
          <p>{modalVentana?.mensaje}</p>
        )}
      </Modal>

      <Modal
        open={modalRenovacion}
        title="Su trámite es Renovación"
        onClose={() => {
          setModalRenovacion(false);
          setFlujo('renovacion');
        }}
        secondaryLabel="Cerrar"
        primaryLabel="Ir a renovación"
        onPrimary={() => {
          void irARenovacion();
        }}
        tone="notice"
        eyebrow="Orientación"
        icon={<RefreshCw className="h-5 w-5" strokeWidth={2.25} />}
      >
        <p>
          Este alumno tuvo beca activa el ciclo pasado, por eso su trámite
          correcto es Renovación.
        </p>
        <p className="mt-3">
          La <strong className="font-semibold text-text">Solicitud nueva</strong>{' '}
          aplica cuando no hubo beca el ciclo pasado (aunque la haya tenido en
          años anteriores). En su caso debe usar{' '}
          <strong className="font-semibold text-text">Renovación</strong>.
        </p>
      </Modal>
    </div>
  );
}
