'use client';

import { CheckCircle2, FileCheck2 } from 'lucide-react';

type Props = {
  autorizada: boolean;
  becaActivada?: boolean;
  firmadoPor?: string | null;
};

/**
 * Señal destacada en expediente admin: beca autorizada y/o carta firmada.
 */
export function AdminEstadoBecaExpediente({
  autorizada,
  becaActivada = false,
  firmadoPor,
}: Props) {
  if (becaActivada) {
    return (
      <div
        className="flex gap-3 rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-emerald-100/80 px-4 py-3.5 shadow-sm sm:px-5"
        role="status"
        aria-live="polite"
      >
        <FileCheck2
          className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-base font-bold text-emerald-900">
            Beca activada — carta firmada
          </p>
          <p className="mt-1 text-sm text-emerald-900/85">
            El padre ya envió la carta de aceptación. El descuento en cobro está
            vigente para colegiaturas.
            {firmadoPor?.trim() ? (
              <>
                {' '}
                Firmó: <span className="font-semibold">{firmadoPor.trim()}</span>.
              </>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  if (!autorizada) return null;

  return (
    <div
      className="flex gap-3 rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-white px-4 py-3.5 shadow-sm sm:px-5"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2
        className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-base font-bold text-emerald-900">Beca autorizada</p>
        <p className="mt-1 text-sm text-emerald-900/85">
          Control Escolar ya autorizó esta beca. El padre podrá firmar la carta
          en el portal de servicios; el descuento en cobro se activará al enviar
          la carta firmada.
        </p>
      </div>
    </div>
  );
}
