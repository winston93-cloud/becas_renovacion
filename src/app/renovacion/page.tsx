'use client';

/**
 * 2026-07-16 - Página de renovación: identifica alumno por ?alumno_ref=
 * 2026-07-16 - Shell institucional, stepper y estados de carga/error.
 * 2026-07-16 - Si ya_registrado, salta al comprobante (sin reeditar).
 */
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { RenovacionPrecarga } from '@/lib/types';
import { AppShell } from '@/components/layout/AppShell';
import { Alert, Button, Card } from '@/components/ui';
import {
  clearAccesoSession,
  fetchConAcceso,
  hasAccesoForRef,
} from '@/lib/acceso-session';
import TabsFormulario from './components/TabsFormulario';
import SubirDocumentos from './components/SubirDocumentos';
import ResumenConfirmacion from './components/ResumenConfirmacion';
import { StepIndicator } from './components/StepIndicator';
import { labelGrado } from '@/lib/label-grado';

type Step = 'form' | 'docs' | 'done';

function RenovacionContent() {
  const searchParams = useSearchParams();
  const alumnoRef = (searchParams.get('alumno_ref') || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RenovacionPrecarga | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [renovacionId, setRenovacionId] = useState<string | null>(null);
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
      try {
        const res = await fetchConAcceso(
          `/api/renovacion?alumno_ref=${encodeURIComponent(alumnoRef)}`
        );
        const json = await res.json();
        if (res.status === 401) {
          clearAccesoSession();
          throw new Error(
            json.error ||
              'Sesión expirada. Regresa al inicio e inicia sesión de nuevo.'
          );
        }
        if (!res.ok) throw new Error(json.error || 'No se pudo cargar la información.');
        if (!cancelled) {
          setData(json);
          if (json.renovacion?.id) setRenovacionId(json.renovacion.id);
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
      titulo="Renovación de Beca"
      alumnoNombre={data?.alumno.nombre_completo}
      alumnoRef={data?.alumno.alumno_ref}
      cicloLabel={data?.ciclo_label}
    >
      <div className="ui-fade-in">
        {!loading && !error && data && !yaRegistrado && (
          <StepIndicator
            current={step}
            ariaLabel="Progreso de renovación de beca"
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
            {/* 2026-07-17 - Alerta suave; el home ya valida acceso, esto es respaldo */}
            <Alert variant="warning" title="No se pudo abrir el trámite">
              <p className="leading-relaxed">{error}</p>
              <p className="mt-2 text-xs opacity-80">
                Puedes corregir el número de control en el inicio e intentarlo
                de nuevo.
              </p>
            </Alert>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Corregir en el inicio
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* 2026-07-18 - Entrada sutil al cambiar de paso */}
        {!loading && !error && data && step === 'form' && !yaRegistrado && (
          <div key="form" className="ui-enter">
            <TabsFormulario
              data={data}
              onSaved={(id) => {
                setRenovacionId(id);
                setStep('docs');
              }}
            />
          </div>
        )}

        {!loading &&
          !error &&
          data &&
          step === 'docs' &&
          renovacionId &&
          (!yaRegistrado || Boolean(data.docs_por_corregir)) && (
            <div key="docs" className="ui-enter">
              <SubirDocumentos
                renovacionId={renovacionId}
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

        {!loading && !error && data && step === 'done' && renovacionId && (
          <div key="done" className="ui-enter">
            <ResumenConfirmacion
              renovacionId={renovacionId}
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
              fechaRegistro={data.renovacion?.correo_enviado_en || null}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function RenovacionPage() {
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
      <RenovacionContent />
    </Suspense>
  );
}
