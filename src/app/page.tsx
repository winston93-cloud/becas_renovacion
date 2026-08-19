'use client';

/**
 * Home — acceso familiar con dos trámites diferenciados (renovación vs solicitud).
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
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
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import {
  APERTURA_PORTAL,
  CIERRE_RENOVACION,
  HORA_APERTURA_CDMX,
  formatPortalFechaEs,
  getPortalStatus,
} from '@/lib/portal-ventanas';

type Flujo = 'renovacion' | 'solicitud';

type AccesoEstado =
  | 'puede_solicitar'
  | 'esperando_respuesta'
  | 'autorizado'
  | 'ya_tiene_beca'
  | 'no_encontrado';

type DocRequeridoUi = { tipo: string; label: string };

export default function HomePage() {
  const router = useRouter();
  const cicloPasadoLabel = useMemo(
    () => getSchoolCycleLabel(getCicloBecaARenovar()),
    []
  );
  const cicloNuevoLabel = useMemo(
    () => getSchoolCycleLabel(getCurrentSchoolCycle()),
    []
  );

  const [renovacionRef, setRenovacionRef] = useState('');
  const [renovacionClave, setRenovacionClave] = useState('');
  const [solicitudRef, setSolicitudRef] = useState('');
  const [solicitudClave, setSolicitudClave] = useState('');

  const [loadingRenovacion, setLoadingRenovacion] = useState(false);
  const [loadingSolicitud, setLoadingSolicitud] = useState(false);
  const [errorRenovacion, setErrorRenovacion] = useState<string | null>(null);
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);
  const [infoSolicitud, setInfoSolicitud] = useState<string | null>(null);
  const [docsAcceso, setDocsAcceso] = useState<{
    nivelLabel: string;
    docs: DocRequeridoUi[];
  } | null>(null);
  const [docsExpandidos, setDocsExpandidos] = useState(false);
  const [modalRenovacion, setModalRenovacion] = useState(false);
  const [modalVentana, setModalVentana] = useState<{
    titulo: string;
    mensaje: string;
    codigo?: string;
  } | null>(null);
  const [enlaceFlujo, setEnlaceFlujo] = useState<Flujo | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fl = params.get('flujo');
    const ref = params.get('alumno_ref');
    const refLimpio = ref ? ref.replace(/\D/g, '') : '';
    if (fl === 'solicitud' || fl === 'renovacion') {
      setEnlaceFlujo(fl);
      if (refLimpio) {
        if (fl === 'renovacion') setRenovacionRef(refLimpio);
        else setSolicitudRef(refLimpio);
      }
    } else if (refLimpio) {
      setRenovacionRef(refLimpio);
      setSolicitudRef(refLimpio);
    }
  }, []);

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

  function limpiarRenovacion() {
    setErrorRenovacion(null);
    setModalRenovacion(false);
  }

  function limpiarSolicitud() {
    setErrorSolicitud(null);
    setInfoSolicitud(null);
    setDocsAcceso(null);
    setDocsExpandidos(false);
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

  async function validarRenovacion(ref: string): Promise<void> {
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
  }

  async function entrarRenovacion(ref: string, clave: string) {
    setModalRenovacion(false);
    setErrorRenovacion(null);
    setLoadingRenovacion(true);
    try {
      await iniciarSesion(ref, clave);
      await validarRenovacion(ref);
      router.push(`/renovacion?alumno_ref=${encodeURIComponent(ref)}`);
    } catch (err) {
      setErrorRenovacion(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado.'
      );
    } finally {
      setLoadingRenovacion(false);
    }
  }

  async function handleRenovacionSubmit(e: FormEvent) {
    e.preventDefault();
    const ref = renovacionRef.trim();
    const clave = renovacionClave;
    if (!ref || !clave) return;
    await entrarRenovacion(ref, clave);
  }

  async function handleSolicitudSubmit(e: FormEvent) {
    e.preventDefault();
    const ref = solicitudRef.trim();
    const clave = solicitudClave;
    if (!ref || !clave) return;
    if (!assertVentanaAbierta('solicitud')) return;

    setErrorSolicitud(null);
    setInfoSolicitud(null);
    setDocsAcceso(null);
    setModalRenovacion(false);
    setLoadingSolicitud(true);

    try {
      await iniciarSesion(ref, clave);

      const statusRes = await fetchConAcceso(
        `/api/solicitud/acceso?alumno_ref=${encodeURIComponent(ref)}`
      );
      const statusJson = await statusRes.json().catch(() => ({}));

      if (!statusRes.ok) {
        if (
          statusJson.estado === 'ya_tiene_beca' ||
          statusJson.codigo === 'YA_TIENE_BECA'
        ) {
          setRenovacionRef(ref);
          setRenovacionClave(clave);
          setModalRenovacion(true);
          return;
        }
        throw new Error(
          statusJson.error || 'No se pudo verificar el número de control.'
        );
      }

      const estado = statusJson.estado as AccesoEstado;

      if (estado === 'ya_tiene_beca') {
        setRenovacionRef(ref);
        setRenovacionClave(clave);
        setModalRenovacion(true);
        return;
      }

      if (estado === 'autorizado') {
        router.push(`/solicitud?alumno_ref=${encodeURIComponent(ref)}`);
        return;
      }

      if (estado === 'esperando_respuesta') {
        tomarDocsDeRespuesta(statusJson);
        setInfoSolicitud(
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
          setRenovacionRef(ref);
          setRenovacionClave(clave);
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
        setInfoSolicitud(
          postJson.mensaje ||
            'Solicitud de acceso enviada. Espere la respuesta del área de becas del Instituto.'
        );
        return;
      }

      setErrorSolicitud(
        statusJson.mensaje || 'No se pudo continuar con el trámite.'
      );
    } catch (err) {
      setErrorSolicitud(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado.'
      );
    } finally {
      setLoadingSolicitud(false);
    }
  }

  const puedeRenovar =
    Boolean(renovacionRef.trim() && renovacionClave) && !loadingRenovacion;
  const puedeSolicitar =
    Boolean(solicitudRef.trim() && solicitudClave) &&
    !loadingSolicitud &&
    !infoSolicitud;

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

      <main className="home-main home-main--trio">
        <div className="home-trio-board">
        {/* Izquierda — Renovación */}
        <section
          className={`home-lane home-lane--renovacion ui-enter ui-enter-delay-1${enlaceFlujo === 'renovacion' ? ' is-highlighted' : ''}`}
          aria-labelledby="home-renovacion-title"
        >
          <div className="home-panel home-panel--renovacion">
            <header className="home-panel-head">
              <span className="home-panel-badge home-panel-badge--renovacion">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Renovación
              </span>
              <h2 id="home-renovacion-title" className="home-panel-title">
                Beca del ciclo anterior
              </h2>
              <p className="home-panel-sub">
                Tuvo <strong>beca Winston</strong> en {cicloPasadoLabel}{' '}
                <span className="home-panel-tag">No SEP</span> y renueva para{' '}
                {cicloNuevoLabel}.
              </p>
            </header>

            <div className="home-panel-body">
              <ul className="home-checklist">
                <li>Beca activa Winston el ciclo pasado</li>
                <li>Mismo trámite: documentos y datos</li>
              </ul>
              <p className="home-panel-note">
                Si <em>no</em> tuvo beca en {cicloPasadoLabel}, use la solicitud
                de la derecha.
              </p>

              {enlaceFlujo === 'renovacion' ? (
                <Alert variant="info" title="Enlace del correo">
                  <p className="leading-relaxed">
                    Trámite de <strong>Renovación</strong>. Número de control
                    listo; ingrese contraseña y continúe.
                  </p>
                </Alert>
              ) : null}

              {errorRenovacion ? (
                <Alert variant="warning" title="No se pudo continuar">
                  <p className="leading-relaxed">{errorRenovacion}</p>
                </Alert>
              ) : null}
            </div>

            <form
              onSubmit={handleRenovacionSubmit}
              className="home-panel-foot home-lane-form"
            >
              <div>
                <Label htmlFor="renovacion_ref" required>
                  No. de Control
                </Label>
                <Input
                  id="renovacion_ref"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="username"
                  value={renovacionRef}
                  onChange={(e) => {
                    setRenovacionRef(e.target.value.replace(/\D/g, ''));
                    limpiarRenovacion();
                  }}
                  placeholder="Ej. 21628"
                />
              </div>
              <div>
                <Label htmlFor="renovacion_clave" required>
                  Contraseña
                </Label>
                <Input
                  id="renovacion_clave"
                  type="password"
                  autoComplete="current-password"
                  value={renovacionClave}
                  onChange={(e) => {
                    setRenovacionClave(e.target.value);
                    limpiarRenovacion();
                  }}
                  placeholder="Contraseña del alumno"
                />
              </div>
              <Button type="submit" disabled={!puedeRenovar} fullWidth>
                {loadingRenovacion ? 'Verificando…' : 'Entrar a renovación'}
                {!loadingRenovacion ? (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                ) : null}
              </Button>
            </form>
          </div>
        </section>

        {/* Centro — Marca */}
        <section className="home-lane home-lane--center ui-enter ui-enter-delay-2">
          <div className="home-panel home-panel--center">
            <header className="home-panel-head home-panel-head--center">
              <p className="home-brand-kicker">Instituto Winston Churchill</p>
              <h1 className="home-hero-title home-hero-title--center">
                Portal de becas
              </h1>
              <p className="home-hero-lead home-hero-lead--center">
                Dos trámites distintos. Elija el que corresponda a su hijo(a).
              </p>
            </header>

            <div className="home-trio-guide" role="note" aria-label="Guía rápida">
              <div className="home-trio-guide__item home-trio-guide__item--left">
                <span className="home-trio-guide__icon" aria-hidden>
                  <RefreshCw className="h-4 w-4" />
                </span>
                <span>
                  <strong>Renovación</strong> — beca Winston {cicloPasadoLabel}
                </span>
              </div>
              <div className="home-trio-guide__item home-trio-guide__item--right">
                <span className="home-trio-guide__icon" aria-hidden>
                  <UserPlus className="h-4 w-4" />
                </span>
                <span>
                  <strong>Solicitud</strong> — sin beca {cicloPasadoLabel}
                </span>
              </div>
            </div>

            <figure className="home-photo home-photo--center">
              <Image
                src="/images/winston-comunidad.jpg"
                alt="Comunidad estudiantil Winston"
                width={640}
                height={400}
                className="home-photo-img"
                sizes="(max-width: 1099px) 100vw, 320px"
                priority
              />
            </figure>
          </div>
        </section>

        {/* Derecha — Solicitud nueva */}
        <section
          className={`home-lane home-lane--solicitud ui-enter ui-enter-delay-3${enlaceFlujo === 'solicitud' ? ' is-highlighted' : ''}`}
          aria-labelledby="home-solicitud-title"
        >
          <div className="home-panel home-panel--solicitud">
            <header className="home-panel-head">
              <span className="home-panel-badge home-panel-badge--solicitud">
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                Solicitud nueva
              </span>
              <h2 id="home-solicitud-title" className="home-panel-title">
                Primera vez o sin beca reciente
              </h2>
              <p className="home-panel-sub">
                <strong>No</strong> tuvo beca Winston en {cicloPasadoLabel}{' '}
                (puede haberla tenido en ciclos anteriores).
              </p>
            </header>

            <div className="home-panel-body">
              <ul className="home-checklist">
                <li>Primera solicitud de beca Winston</li>
                <li>Pide acceso; CE autoriza el formulario</li>
              </ul>
              <p className="home-panel-note">
                Si tuvo beca activa en {cicloPasadoLabel}, use{' '}
                <strong>Renovación</strong> (izquierda).
              </p>

              {enlaceFlujo === 'solicitud' ? (
                <Alert variant="info" title="Enlace del correo">
                  <p className="leading-relaxed">
                    Trámite de <strong>Solicitud</strong>. Número de control
                    listo; ingrese contraseña y continúe.
                  </p>
                </Alert>
              ) : null}

              {errorSolicitud ? (
                <Alert variant="warning" title="No se pudo continuar">
                  <p className="leading-relaxed">{errorSolicitud}</p>
                </Alert>
              ) : null}

              {infoSolicitud ? (
                <Alert variant="info" title="Solicitud de acceso">
                  {infoSolicitud}
                </Alert>
              ) : null}

              {infoSolicitud && docsAcceso ? (
                <aside
                  className={`home-docs-card ui-enter${docsExpandidos ? ' is-open' : ''}`}
                  aria-label="Documentos para el trámite"
                >
                  <div className="home-docs-card__head">
                    <span className="home-docs-card__icon" aria-hidden>
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="home-docs-card__copy">
                      <p className="home-docs-card__kicker">
                        Prepare su expediente
                      </p>
                      <h3 className="home-docs-card__title">
                        Documentos ({docsAcceso.nivelLabel})
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="home-docs-toggle"
                    aria-expanded={docsExpandidos}
                    aria-controls="home-docs-panel"
                    onClick={() => setDocsExpandidos((v) => !v)}
                  >
                    <span>
                      {docsExpandidos
                        ? 'Colapsar'
                        : `Ver lista (${docsAcceso.docs.length})`}
                    </span>
                    <ChevronDown
                      className={`home-docs-toggle__chevron h-4 w-4${docsExpandidos ? ' is-open' : ''}`}
                      aria-hidden
                    />
                  </button>

                  <div
                    id="home-docs-panel"
                    className="home-docs-panel"
                    hidden={!docsExpandidos}
                  >
                    <ol className="home-docs-list">
                      {docsAcceso.docs.map((doc, idx) => (
                        <li key={doc.tipo} className="home-docs-list__item">
                          <span className="home-docs-list__num" aria-hidden>
                            {idx + 1}
                          </span>
                          <span className="home-docs-list__label">
                            {doc.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </aside>
              ) : null}
            </div>

            <form
              onSubmit={handleSolicitudSubmit}
              className="home-panel-foot home-lane-form"
            >
              <div>
                <Label htmlFor="solicitud_ref" required>
                  No. de Control
                </Label>
                <Input
                  id="solicitud_ref"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="username"
                  value={solicitudRef}
                  onChange={(e) => {
                    setSolicitudRef(e.target.value.replace(/\D/g, ''));
                    limpiarSolicitud();
                  }}
                  placeholder="Ej. 21628"
                />
              </div>
              <div>
                <Label htmlFor="solicitud_clave" required>
                  Contraseña
                </Label>
                <Input
                  id="solicitud_clave"
                  type="password"
                  autoComplete="current-password"
                  value={solicitudClave}
                  onChange={(e) => {
                    setSolicitudClave(e.target.value);
                    limpiarSolicitud();
                  }}
                  placeholder="Contraseña del alumno"
                />
              </div>
              <Button type="submit" disabled={!puedeSolicitar} fullWidth>
                {loadingSolicitud
                  ? 'Verificando…'
                  : infoSolicitud
                    ? 'Esperando respuesta'
                    : 'Solicitar acceso a beca'}
                {!loadingSolicitud && !infoSolicitud ? (
                  <UserPlus className="h-4 w-4" aria-hidden />
                ) : null}
              </Button>
            </form>
          </div>
        </section>
        </div>
      </main>

      <footer className="home-footer ui-enter ui-enter-delay-3">
        <span>Instituto Winston Churchill · Sistema de Becas</span>
        <span>Ciclo {cicloNuevoLabel}</span>
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
          </>
        ) : (
          <p>{modalVentana?.mensaje}</p>
        )}
      </Modal>

      <Modal
        open={modalRenovacion}
        title="Debe usar Renovación (columna izquierda)"
        onClose={() => setModalRenovacion(false)}
        secondaryLabel="Cerrar"
        primaryLabel="Ir a renovación"
        onPrimary={() => {
          const ref = renovacionRef.trim() || solicitudRef.trim();
          const clave = renovacionClave || solicitudClave;
          if (ref && clave) void entrarRenovacion(ref, clave);
        }}
        tone="notice"
        eyebrow="Orientación"
        icon={<RefreshCw className="h-5 w-5" strokeWidth={2.25} />}
      >
        <p>
          Este alumno tuvo <strong>beca Winston activa</strong> el ciclo{' '}
          {cicloPasadoLabel}. Su trámite correcto es{' '}
          <strong>Renovación</strong>, no Solicitud de beca.
        </p>
        <p className="mt-3">
          La columna derecha es solo para quienes{' '}
          <strong>no</strong> tuvieron beca Winston ese ciclo (aunque la hayan
          tenido en años anteriores).
        </p>
      </Modal>
    </div>
  );
}
