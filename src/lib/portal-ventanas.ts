/**
 * 2026-07-22 - Ventanas de apertura/cierre del Portal de Becas.
 * Zona: America/Ciudad_Juarez (calendario local, día inclusive).
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

/** Cierre de renovación (inclusive, fin del día). Solicitud no cierra. */
export const CIERRE_RENOVACION = { y: 2026, m: 8, d: 17 } as const;

const TZ = 'America/Ciudad_Juarez';

/** Fecha local Y-M-D en la zona del Instituto. */
export function fechaLocalParts(now: Date = new Date()): {
  y: number;
  m: number;
  d: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);

  return { y: get('year'), m: get('month'), d: get('day') };
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

/**
 * Estado de la ventana según el trámite.
 * Renovación: [APERTURA_PORTAL, CIERRE_RENOVACION].
 * Solicitud: desde APERTURA_PORTAL sin cierre.
 */
export function getPortalStatus(
  flujo: FlujoPortal,
  now: Date = new Date()
): PortalStatus {
  const hoy = fechaLocalParts(now);
  const aperturaLabel = formatFechaEs(APERTURA_PORTAL);
  const cierreRenLabel = formatFechaEs(CIERRE_RENOVACION);

  if (cmpFecha(hoy, APERTURA_PORTAL) < 0) {
    return {
      open: false,
      codigo: 'PORTAL_CERRADO',
      titulo: 'Portal cerrado',
      mensaje: `El Portal de Becas abrirá el ${aperturaLabel}. Por favor intente a partir de esa fecha.`,
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
