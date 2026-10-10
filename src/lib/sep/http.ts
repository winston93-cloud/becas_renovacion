/**
 * 2026-10-07 - Respuestas HTTP comunes del trámite Beca SEP.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { EscrituraBloqueada } from '@/lib/insforge-server';
import { documentoVigente, ErrorSep, puedeEnviar } from '@/lib/sep/servicio';
import { ETIQUETA_ESTADO_SEP, MAX_INTENTOS_DOCUMENTO, type SolicitudSep } from '@/lib/sep/tipos';

export function respuestaError(err: unknown, contexto: string) {
  if (err instanceof ErrorSep) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof EscrituraBloqueada) {
    return NextResponse.json({ error: err.message, codigo: 'SOLO_LECTURA' }, { status: 423 });
  }
  console.error(`[sep] ${contexto}`, err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : 'Ocurrió un error inesperado.' },
    { status: 500 }
  );
}

/** Lo que ve la familia de su trámite (sin cálculo interno ni texto completo del documento). */
export function vistaFamilia(s: SolicitudSep | null) {
  if (!s) return null;
  const doc = documentoVigente(s);
  return {
    id: s.id,
    estado: s.estado,
    etiquetaEstado: ETIQUETA_ESTADO_SEP[s.estado],
    intentosFallidos: s.intentosFallidos,
    maxIntentos: MAX_INTENTOS_DOCUMENTO,
    motivoCorreccion: s.motivoCorreccion,
    porcentajeAplicado: s.estado === 'aplicada' ? s.porcentajeConfirmado : null,
    enviadaEn: s.enviadaEn,
    aplicadaEn: s.aplicadaEn,
    puedeEnviar: puedeEnviar(s),
    documento: doc
      ? {
          nombre: doc.nombreOriginal,
          subidoEn: doc.subidoEn,
          legible: doc.deteccion.legible,
          valido: doc.deteccion.valido,
          porcentajeDetectado: doc.deteccion.porcentajeDetectado,
          nombreDetectado: doc.deteccion.nombreDetectado,
          motivos: doc.deteccion.motivos,
        }
      : null,
  };
}
