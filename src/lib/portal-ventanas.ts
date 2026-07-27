/**
 * 2026-07-22 - Ventanas de apertura/cierre del Portal de Becas.
 * 2026-07-24 - Zona America/Mexico_City; apertura a las 09:00.
 * 2026-07-27 - Apertura efectiva desde 00:00 del día de apertura (producción).
 */

export type FlujoPortal = 'renovacion' | 'solicitud';

export type PortalStatus = {
  open: boolean;
  codigo: 'OK' | 'PORTAL_CERRADO' | 'RENOVACION_CERRADA';
  titulo: string;
  mensaje: string;
};

/** Apertura de renovación y solicitud nueva (inclusive). */
// 2026-07-22 - Apertura corregida a julio (no junio)
export const APERTURA_PORTAL = { y: 2026, m: 7, d: 27 } as const;

/** Hora de apertura en CDMX (00:00 = todo el día de apertura). */
export const HORA_APERTURA_CDMX = 0;

/** Cierre de renovación (inclusive, fin del día). Solicitud no cierra. */
export const CIERRE_RENOVACION = { y: 2026, m: 8, d: 17 } as const;

const TZ = 'America/Mexico_City';

/** Fecha/hora local en CDMX. */
export function fechaHoraLocalParts(now: Date = new Date()): {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    h: get('hour'),
    min: get('minute'),
  };
}

/** Fecha local Y-M-D en CDMX. */
export function fechaLocalParts(now: Date = new Date()): {
  y: number;
  m: number;
  d: number;
} {
  const { y, m, d } = fechaHoraLocalParts(now);
  return { y, m, d };
}

function cmpFecha(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number }
): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

function formatFechaEs(f: { y: number; m: number; d: number }): string {
  const dt = new Date(Date.UTC(f.y, f.m - 1, f.d, 12));
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

/** Etiqueta legible de apertura/cierre (para UI). */
export function formatPortalFechaEs(f: {
  y: number;
  m: number;
  d: number;
}): string {
  return formatFechaEs(f);
}

/** True si ya pasó la hora de apertura el día de apertura (o días posteriores). */
function yaPasoHoraApertura(now: Date): boolean {
  const local = fechaHoraLocalParts(now);
  const cmp = cmpFecha(local, APERTURA_PORTAL);
  if (cmp > 0) return true;
  if (cmp < 0) return false;
  return local.h > HORA_APERTURA_CDMX ||
    (local.h === HORA_APERTURA_CDMX && local.min >= 0);
}

/**
 * Estado de la ventana según el trámite.
 * Renovación: [APERTURA_PORTAL 00:00 CDMX, CIERRE_RENOVACION fin del día].
 * Solicitud: desde APERTURA_PORTAL 00:00 CDMX sin cierre.
 */
export function getPortalStatus(
  flujo: FlujoPortal,
  now: Date = new Date()
): PortalStatus {
  const hoy = fechaLocalParts(now);
  const aperturaLabel = formatFechaEs(APERTURA_PORTAL);
  const cierreRenLabel = formatFechaEs(CIERRE_RENOVACION);
  const horaLabel = `${String(HORA_APERTURA_CDMX).padStart(2, '0')}:00`;

  if (!yaPasoHoraApertura(now)) {
    return {
      open: false,
      codigo: 'PORTAL_CERRADO',
      titulo: 'Portal cerrado',
      mensaje: `El Portal de Becas abrirá el ${aperturaLabel} a las ${horaLabel} (hora de la CDMX). Por favor intente a partir de esa fecha y hora.`,
    };
  }

  if (flujo === 'renovacion' && cmpFecha(hoy, CIERRE_RENOVACION) > 0) {
    return {
      open: false,
      codigo: 'RENOVACION_CERRADA',
      titulo: 'Renovación cerrada',
      mensaje: `El período de renovación de beca concluyó el ${cierreRenLabel}. Para dudas, acuda al área de becas del Instituto.`,
    };
  }

  return {
    open: true,
    codigo: 'OK',
    titulo: '',
    mensaje: '',
  };
}

/** Respuesta JSON 403 para Route Handlers. */
export function portalCerradoResponse(flujo: FlujoPortal, now?: Date) {
  const status = getPortalStatus(flujo, now);
  return {
    error: status.mensaje || 'El portal no está disponible en este momento.',
    codigo: status.codigo,
    titulo: status.titulo,
  };
}

/**
 * 2026-07-22 - Guard para Route Handlers. null = ventana abierta.
 */
export function assertPortalAbierto(
  flujo: FlujoPortal,
  now?: Date
): { error: string; codigo: string; titulo: string } | null {
  const status = getPortalStatus(flujo, now);
  if (status.open) return null;
  return portalCerradoResponse(flujo, now);
}
