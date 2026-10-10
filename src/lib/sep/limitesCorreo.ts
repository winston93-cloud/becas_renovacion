/**
 * 2026-10-09 - Límites de frecuencia de los correos Beca SEP a las familias, para no saturarlas ni que los
 * proveedores (Gmail, Outlook) marquen el buzón como spam. Se cuentan solo los correos que sí salieron.
 */
import type { EventoSep, TipoCorreoSep } from '@/lib/sep/tipos';

const HORA = 60 * 60 * 1000;

/** Tipos que se envían. "recibido" no: la familia ya ve la confirmación en pantalla al enviar. */
export const CORREOS_ACTIVOS: Record<TipoCorreoSep, boolean> = {
  recibido: false,
  correccion: true,
  aplicada: true,
  actualizada: true,
  pago: true,
};

/** Horas mínimas entre dos correos del mismo tipo para el mismo trámite. */
export const ESPERA_MISMO_TIPO_H: Record<TipoCorreoSep, number> = {
  recibido: 24,
  correccion: 1,
  aplicada: 1,
  actualizada: 24,
  pago: 24 * 7,
};

/** Máximo de correos por trámite en 24 h (la confirmación de beca aplicada no se bloquea por este tope). */
export const MAX_CORREOS_24H = 2;

const enviados = (historial: EventoSep[]) => historial.filter((e) => e.correo?.enviado);

/** Fecha desde la que se puede volver a mandar ese tipo de correo (null = ya se puede). */
export function siguienteCorreoPermitido(tipo: TipoCorreoSep, historial: EventoSep[], ahora = Date.now()): Date | null {
  const ultimo = enviados(historial)
    .filter((e) => e.correo!.tipo === tipo)
    .map((e) => Date.parse(e.fecha))
    .sort((a, b) => b - a)[0];
  if (ultimo == null) return null;
  const libre = ultimo + ESPERA_MISMO_TIPO_H[tipo] * HORA;
  return libre > ahora ? new Date(libre) : null;
}

/** Motivo para NO enviar el correo ahora (null = se puede enviar). */
export function motivoNoEnviarCorreo(tipo: TipoCorreoSep, historial: EventoSep[], ahora = Date.now()): string | null {
  if (!CORREOS_ACTIVOS[tipo]) return 'este aviso no se envía por correo (la familia lo ve en pantalla)';
  const libre = siguienteCorreoPermitido(tipo, historial, ahora);
  if (libre) {
    return `ya se le envió este mismo aviso hace poco; se puede volver a enviar a partir del ${libre.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Mexico_City',
    })}`;
  }
  if (tipo !== 'aplicada') {
    const ultimas24 = enviados(historial).filter((e) => ahora - Date.parse(e.fecha) < 24 * HORA).length;
    if (ultimas24 >= MAX_CORREOS_24H) return `la familia ya recibió ${ultimas24} correos en las últimas 24 horas`;
  }
  return null;
}
