/**
 * 2026-07-16 - Helpers para armar PdfSolicitudData / PdfComprobanteData desde filas BD.
 */
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrado } from '@/lib/label-grado';
import { labelGrupo } from '@/lib/label-grupo';
import type { PdfFamiliar, PdfHermano, PdfSolicitudData } from '@/lib/pdf/types';

function str(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

function money(v: unknown): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return str(v);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n);
}

function viveLabel(v: unknown): string {
  if (v === true || v === 1 || v === '1') return 'Sí';
  if (v === false || v === 0 || v === '0') return 'No';
  return '—';
}

function formatNombre(app?: string, apm?: string, nombre?: string): string {
  return `${app || ''} ${apm || ''} ${nombre || ''}`.trim() || '—';
}

export function formatFechaEsMx(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date());
  }
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

export function mapFamiliarFromRow(
  row: Record<string, unknown> | null | undefined,
  ingreso: unknown
): PdfFamiliar {
  if (!row) {
    return {
      nombre: '—',
      vive: '—',
      ingresoMensual: money(ingreso),
      empresa: '—',
      puesto: '—',
      tel: '—',
      cel: '—',
      email: '—',
    };
  }
  return {
    nombre: formatNombre(
      row.familiar_app as string,
      row.familiar_apm as string,
      row.familiar_nombre as string
    ),
    vive: viveLabel(row.familiar_vive),
    ingresoMensual: money(ingreso),
    empresa: str(row.familiar_empresa_nombre),
    puesto: str(row.familiar_empresa_puesto),
    tel: str(row.familiar_tel),
    cel: str(row.familiar_cel),
    email: str(row.familiar_email),
  };
}

export function mapHermanosFromRows(
  rows: Record<string, unknown>[] | null | undefined
): PdfHermano[] {
  if (!rows?.length) return [];
  return rows
    .filter((h) => (h.nombre as string)?.trim())
    .map((h) => ({
      orden: Number(h.orden) || 0,
      nombre: str(h.nombre),
      edad: h.edad != null ? String(h.edad) : '—',
      institucion: str(h.institucion),
      colegiatura: money(h.colegiatura_mensual),
    }))
    .sort((a, b) => a.orden - b.orden);
}

type BuildSolicitudInput = {
  alumno: Record<string, unknown>;
  detalle: Record<string, unknown> | null;
  mama: Record<string, unknown> | null;
  papa: Record<string, unknown> | null;
  renovacion: Record<string, unknown>;
  hermanos: Record<string, unknown>[];
  becaClase: string;
  becaPorcentaje: number;
  promedioRequerido: string;
  cicloLabel: string;
  nivelLabel?: string;
  /** 2026-07-16 - Ingresos solo para PDF (no se leen de BD por política) */
  ingresoPadre?: unknown;
  ingresoMadre?: unknown;
};

export function buildSolicitudDataFromRows(
  input: BuildSolicitudInput
): PdfSolicitudData {
  const { alumno, detalle, mama, papa, renovacion, hermanos } = input;
  const nombreCompleto = formatNombre(
    alumno.alumno_app as string,
    alumno.alumno_apm as string,
    alumno.alumno_nombre as string
  );

  // Preferir ingresos explícitos del request; no usar BD
  const ingresoPadre =
    input.ingresoPadre !== undefined
      ? input.ingresoPadre
      : renovacion.ingreso_mensual_padre;
  const ingresoMadre =
    input.ingresoMadre !== undefined
      ? input.ingresoMadre
      : renovacion.ingreso_mensual_madre;

  return {
    alumnoNombre: nombreCompleto,
    alumnoRef: String(alumno.alumno_ref),
    nivelLabel:
      input.nivelLabel ||
      labelNivel(
        alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null
      ),
    grado: labelGrado(
      alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
      alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null
    ),
    grupo: labelGrupo(alumno.alumno_grupo as number | string | null),
    cicloLabel: input.cicloLabel,
    becaClase: input.becaClase,
    becaPorcentaje: String(input.becaPorcentaje),
    promedioRequerido: input.promedioRequerido || '—',
    domicilio: {
      calle: str(detalle?.alumno_calle),
      numero: str(detalle?.alumno_numero),
      colonia: str(detalle?.alumno_colonia),
      cp: str(detalle?.alumno_cp),
      municipio: 'MADERO',
      estado: 'TAMAULIPAS',
    },
    papa: mapFamiliarFromRow(papa, ingresoPadre),
    mama: mapFamiliarFromRow(mama, ingresoMadre),
    otraBeca: renovacion.otra_beca ? 'Sí' : 'No',
    otraBecaPct:
      renovacion.otra_beca_porcentaje != null
        ? `${renovacion.otra_beca_porcentaje}%`
        : '—',
    casaTipo: str(renovacion.casa_tipo),
    motivo: str(renovacion.motivo),
    observaciones: str(renovacion.observaciones),
    hermanos: mapHermanosFromRows(hermanos),
    fechaGeneracion: formatFechaEsMx(),
  };
}

/** 2026-07-17 - Mapeo PDF para solicitud de beca (nuevo ingreso). */
type BuildSolicitudNuevaInput = {
  alumno: Record<string, unknown>;
  detalle: Record<string, unknown> | null;
  mama: Record<string, unknown> | null;
  papa: Record<string, unknown> | null;
  solicitud: Record<string, unknown>;
  hermanos: Record<string, unknown>[];
  becaClase: string;
  becaPorcentaje: number;
  promedioRequerido: string;
  cicloLabel: string;
  nivelLabel?: string;
  /** Solo body; no leer de BD */
  ingresoPadre?: unknown;
  ingresoMadre?: unknown;
};

function otraBecaLabelFromSolicitud(s: Record<string, unknown>): {
  otraBeca: string;
  otraBecaPct: string;
} {
  if (!s.tiene_otra_beca) {
    return { otraBeca: 'No', otraBecaPct: '—' };
  }
  const tipos: string[] = [];
  // 2026-07-18 - SEP omitido (beca de gobierno; no se tramita en este portal)
  if (s.otra_beca_pemex) tipos.push('PEMEX');
  if (s.otra_beca_empresarial) tipos.push('Empresarial');
  if (s.otra_beca_otro) tipos.push('Otro');
  return {
    otraBeca: tipos.length > 0 ? `Sí (${tipos.join(', ')})` : 'Sí',
    otraBecaPct: '—',
  };
}

export function buildSolicitudNuevaDataFromRows(
  input: BuildSolicitudNuevaInput
): PdfSolicitudData {
  const { alumno, detalle, mama, papa, solicitud, hermanos } = input;
  const nombreCompleto = formatNombre(
    alumno.alumno_app as string,
    alumno.alumno_apm as string,
    alumno.alumno_nombre as string
  );
  const { otraBeca, otraBecaPct } = otraBecaLabelFromSolicitud(solicitud);

  return {
    alumnoNombre: nombreCompleto,
    alumnoRef: String(alumno.alumno_ref),
    nivelLabel:
      input.nivelLabel ||
      labelNivel(
        alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null
      ),
    grado: labelGrado(
      alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
      alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null
    ),
    grupo: labelGrupo(alumno.alumno_grupo as number | string | null),
    cicloLabel: input.cicloLabel,
    becaClase: input.becaClase,
    becaPorcentaje: String(input.becaPorcentaje),
    promedioRequerido: input.promedioRequerido || '—',
    domicilio: {
      calle: str(detalle?.alumno_calle),
      numero: str(detalle?.alumno_numero),
      colonia: str(detalle?.alumno_colonia),
      cp: str(detalle?.alumno_cp),
      municipio: 'MADERO',
      estado: 'TAMAULIPAS',
    },
    papa: mapFamiliarFromRow(papa, input.ingresoPadre),
    mama: mapFamiliarFromRow(mama, input.ingresoMadre),
    otraBeca,
    otraBecaPct,
    casaTipo: str(solicitud.vivienda_tipo),
    motivo: str(solicitud.motivo),
    observaciones: '—',
    hermanos: mapHermanosFromRows(hermanos),
    fechaGeneracion: formatFechaEsMx(),
  };
}
