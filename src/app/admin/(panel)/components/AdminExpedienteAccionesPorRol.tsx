'use client';

/**
 * Acciones del expediente en dos bloques:
 * - Control Escolar: verificar / quitar verificación
 * - Dirección (por nivel): carta, rechazo, autorizar, seguimiento
 */
import type { ReactNode } from 'react';
import { Alert, Button, Card } from '@/components/ui';

export function tituloDireccionNivel(nivelLabel: string): string {
  const n = (nivelLabel || '').trim();
  if (!n) return 'Dirección';
  if (/^direcci[oó]n/i.test(n)) return n;
  return `Dirección de ${n}`;
}

type Props = {
  nivelLabel: string;
  verificado: boolean;
  fechaVerificado: string | null;
  docsOk: boolean;
  saving: boolean;
  onToggleVerificado: () => void;
  /** Botones y controles de Dirección (carta, rechazo, autorizar, seguimiento). */
  accionesDireccion: ReactNode;
  /** Aviso bajo el bloque de Dirección (p. ej. no autorizar sin verificar). */
  avisoDireccion?: ReactNode;
};

export function AdminExpedienteAccionesPorRol({
  nivelLabel,
  verificado,
  fechaVerificado,
  docsOk,
  saving,
  onToggleVerificado,
  accionesDireccion,
  avisoDireccion,
}: Props) {
  const tituloDir = tituloDireccionNivel(nivelLabel);

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <Card className="flex h-full flex-col space-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
            Control Escolar
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-primary">
            Verificación del expediente
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Primero revise cada documento (Revisar → correcto / incorrecto).
            Cuando todos estén OK, marque el expediente como verificado.
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <Button
            type="button"
            className="!min-h-[44px] w-full sm:w-auto"
            disabled={saving || (!verificado && !docsOk)}
            onClick={onToggleVerificado}
            title={
              !verificado && !docsOk
                ? 'Revise todos los documentos y márquelos OK primero'
                : undefined
            }
          >
            {verificado ? 'Quitar verificación' : '✓ Marcar como verificada'}
          </Button>

          {!verificado && !docsOk ? (
            <p className="text-xs text-amber-800">
              Aún no se puede verificar: faltan documentos por revisar o hay
              alguno marcado como incorrecto.
            </p>
          ) : null}

          {fechaVerificado ? (
            <p className="text-xs text-text-secondary">
              Verificada el{' '}
              {new Date(fechaVerificado).toLocaleString('es-MX')}
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="flex h-full flex-col space-y-3 border-primary/20 bg-gradient-to-br from-white via-[#fffaf3]/70 to-[#f3f7fb]/80">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
            {tituloDir}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-primary">
            Resolución de beca
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Carta de aceptación, seguimiento individualizado, rechazo y
            autorización. Corresponde a la directora del nivel del alumno.
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="space-y-3">{accionesDireccion}</div>
          {avisoDireccion}
        </div>
      </Card>
    </div>
  );
}

export function AvisoAutorizarSinVerificar({
  autorizada,
  verificado,
}: {
  autorizada: boolean;
  verificado: boolean;
}) {
  if (autorizada || verificado) return null;
  return (
    <Alert variant="warning">
      No se puede autorizar la beca hasta que Control Escolar verifique el
      expediente.
    </Alert>
  );
}
