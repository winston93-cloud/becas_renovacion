'use client';

/**
 * 2026-07-17 - Página de solicitud de beca (nuevo ingreso).
 * Identifica alumno por ?alumno_ref=; gate de permiso + sin alumno_beca.
 */
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { SolicitudPrecarga } from '@/lib/types';
import { AppShell } from '@/components/layout/AppShell';
import { Alert, Button, Card } from '@/components/ui';
import {
  clearAccesoSession,
  fetchConAcceso,
  hasAccesoForRef,
} from '@/lib/acceso-session';
import TabsFormularioSolicitud from './components/TabsFormularioSolicitud';
import SubirDocumentosSolicitud from './components/SubirDocumentosSolicitud';
import ResumenConfirmacionSolicitud from './components/ResumenConfirmacionSolicitud';
import { StepIndicator } from '../renovacion/components/StepIndicator';
import { labelGrado } from '@/lib/label-grado';

type Step = 'form' | 'docs' | 'done';

function SolicitudContent() {
  const searchParams = useSearchParams();
  const alumnoRef = (searchParams.get('alumno_ref') || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [data, setData] = useState<SolicitudPrecarga | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [solicitudId, setSolicitudId] = useState<string | null>(null);
  const [yaRegistrado, setYaRegistrado] = useState(false);

  useEffect(() => {
    if (!alumnoRef) {
      setLoading(false);
      setError(
        'Falta el número de control. Regresa al inicio e ingrésalo para continuar.'
      );
      return;
    }

    // 2026-07-22 - Sin sesión (contraseña) no se puede cargar el trámite
    if (!hasAccesoForRef(alumnoRef)) {
      setLoading(false);
      setError(
        'Debe iniciar sesión en el inicio con número de control y contraseña.'
      );
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setErrorCodigo(null);
      try {
        const res = await fetchConAcceso(
          `/api/solicitud?alumno_ref=${encodeURIComponent(alumnoRef)}`
        );
        const json = await res.json();
        if (res.status === 401) {
          clearAccesoSession();
          throw new Error(
            json.error ||
              'Sesión expirada. Regresa al inicio e inicia sesión de nuevo.'
          );
        }
        if (!res.ok) {
          if (!cancelled) {
            setErrorCodigo(json.codigo || null);
          }
          throw new Error(json.error || 'No se pudo cargar la información.');
        }
        if (!cancelled) {
          setData(json);
          if (json.solicitud?.id) setSolicitudId(json.solicitud.id);
          if (json.ya_registrado) {
            setYaRegistrado(true);
            setStep(json.docs_por_corregir ? 'docs' : 'done');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [alumnoRef]);

  return (
    <AppShell
      titulo="Solicitud de Beca"
      alumnoNombre={data?.alumno.nombre_completo}
      alumnoRef={data?.alumno.alumno_ref}
      cicloLabel={data?.ciclo_label}
    >
      <div className="ui-fade-in">
        {!loading && !error && data && !yaRegistrado && (
          <StepIndicator
            current={step}
            ariaLabel="Progreso de solicitud de beca"
          />
        )}

        {loading && (
          <Card className="ui-enter text-center">
            <div className="ui-spinner mx-auto mb-4" aria-hidden />
            <p className="text-sm text-text-secondary">
              Cargando información del alumno...
            </p>
          </Card>
        )}

        {!loading && error && (
          <Card className="ui-enter">
            <Alert
              variant="warning"
              title={
                errorCodigo === 'NO_AUTORIZADO'
                  ? 'Acceso pendiente'
                  : errorCodigo === 'YA_TIENE_BECA'
                    ? 'Trámite distinto'
                    : 'No se pudo abrir el trámite'
              }
            >
              <p className="leading-relaxed">{error}</p>
              <p className="mt-2 text-xs opacity-80">
                Puedes corregir el número de control o el tipo de trámite en el
                inicio.
              </p>
            </Alert>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Corregir en el inicio
                </Button>
              </Link>
              {errorCodigo === 'YA_TIENE_BECA' && (
                <Link
                  href={`/renovacion?alumno_ref=${encodeURIComponent(alumnoRef)}`}
                  className="w-full sm:w-auto"
                >
                  <Button className="w-full sm:w-auto">Ir a renovación</Button>
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* 2026-07-18 - Entrada sutil al cambiar de paso */}
        {!loading && !error && data && step === 'form' && !yaRegistrado && (
          <div key="form" className="ui-enter">
            <TabsFormularioSolicitud
              data={data}
              onSaved={(id) => {
                setSolicitudId(id);
                setStep('docs');
              }}
            />
          </div>
        )}

        {!loading &&
          !error &&
          data &&
          step === 'docs' &&
          solicitudId &&
          (!yaRegistrado || Boolean(data.docs_por_corregir)) && (
            <div key="docs" className="ui-enter">
              <SubirDocumentosSolicitud
                solicitudId={solicitudId}
                documentosIniciales={data.documentos}
                nivel={data.alumno.alumno_nivel}
                grado={data.alumno.alumno_grado}
                modoCorreccion={yaRegistrado}
                onComplete={() => {
                  setData((prev) =>
                    prev
                      ? {
                          ...prev,
                          docs_por_corregir: false,
                          documentos: prev.documentos.map((d) =>
                            d.revision_estado === 'incorrecto'
                              ? {
                                  ...d,
                                  revision_estado: 'reenviado',
                                  revision_nota: null,
                                }
                              : d
                          ),
                        }
                      : prev
                  );
                  setStep('done');
                }}
              />
            </div>
          )}

        {!loading && !error && data && step === 'done' && solicitudId && (
          <div key="done" className="ui-enter">
            <ResumenConfirmacionSolicitud
              solicitudId={solicitudId}
              alumnoNombre={data.alumno.nombre_completo}
              alumnoRef={data.alumno.alumno_ref}
              cicloLabel={data.ciclo_label}
              grado={(() => {
                const g = labelGrado(
                  data.alumno.alumno_nivel,
                  data.alumno.alumno_grado
                );
                return g === '—' ? null : g;
              })()}
              grupo={data.alumno.alumno_grupo}
              yaRegistrado={yaRegistrado}
              fechaRegistro={data.solicitud?.enviado_en || null}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function SolicitudPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <Card className="text-center">
            <p className="text-sm text-text-secondary">Cargando...</p>
          </Card>
        </AppShell>
      }
    >
      <SolicitudContent />
    </Suspense>
  );
}
