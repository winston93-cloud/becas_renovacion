/**
 * 2026-10-12 - Filtros, orden y paginación del panel Beca SEP (Control Escolar).
 * Funciones puras: la cola de trabajo no se vuelve un scroll infinito cuando hay muchas familias.
 */
import type { EstadoSep } from '@/lib/sep/tipos';

export const POR_PAGINA_SEP = 25;

export type SeccionSep = 'tramites' | 'cuestionario';
export type VistaTramite = 'revisar' | 'familia' | 'aplicadas';
export type OrdenTramite = 'espera' | 'reciente' | 'nombre' | 'control' | 'porcentaje';
export type FiltroCuestionario = 'todas' | 'sep' | 'otra' | 'no' | 'recibio' | 'espera' | 'sin_doc' | 'prueba';

export type FilaTramiteSep = {
  id: string;
  alumnoRef: number;
  nombreAlumno: string;
  nivel: number | null;
  grado: number | null;
  estado: EstadoSep;
  porcentaje: number | null;
  monto: number | null;
  fecha: string;
  revisionManual: boolean;
  motivoCorreccion: string | null;
};

export type ResumenBxPanel = {
  contestaron: number;
  noAplicaron: number;
  aplicaron: number;
  sep: { total: number; recibida: number; enEspera: number };
  otra: { total: number; recibida: number; enEspera: number; nombres: { nombre: string; total: number }[] };
  dePrueba: number;
};

export type FilaCuestionarioSep = {
  alumnoRef: number | null;
  alumnoNivel: number | null;
  aplico: boolean;
  beneficio: 'sep' | 'otra' | null;
  beneficioNombre: string | null;
  recibio: boolean | null;
  esPrueba: boolean;
  actualizadoEn: string | null;
  tieneTramite: boolean;
  tramiteId: string | null;
};

export const VISTAS_TRAMITE: { valor: VistaTramite; texto: string; estados: EstadoSep[]; vacio: string }[] = [
  { valor: 'revisar', texto: 'Por revisar', estados: ['enviada'], vacio: 'No hay documentos por revisar.' },
  { valor: 'familia', texto: 'Esperando a la familia', estados: ['correccion', 'borrador'], vacio: 'Ninguna familia tiene un documento pendiente.' },
  { valor: 'aplicadas', texto: 'Aplicadas', vacio: 'Todavía no hay becas aplicadas en este ciclo.', estados: ['aplicada'] },
];

export function normalizarBusqueda(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function coincideBusqueda(haystack: string, q: string): boolean {
  if (!q) return true;
  const nq = normalizarBusqueda(q);
  const tokens = nq.split(/\s+/).filter(Boolean);
  const h = normalizarBusqueda(haystack);
  return tokens.every((t) => h.includes(t));
}

export function estadosDeVista(vista: VistaTramite): EstadoSep[] {
  return VISTAS_TRAMITE.find((v) => v.valor === vista)?.estados ?? VISTAS_TRAMITE[0].estados;
}

export function gradosDeTramites(filas: FilaTramiteSep[]): number[] {
  return [...new Set(filas.map((f) => f.grado).filter((g): g is number => g != null))].sort((a, b) => a - b);
}

export function filtrarTramites(
  filas: FilaTramiteSep[],
  opts: { vista: VistaTramite; q: string; grado: number | null; soloManual: boolean }
): FilaTramiteSep[] {
  const estados = estadosDeVista(opts.vista);
  return filas.filter((f) => {
    if (!estados.includes(f.estado)) return false;
    if (opts.grado != null && f.grado !== opts.grado) return false;
    if (opts.soloManual && !f.revisionManual) return false;
    return coincideBusqueda(`${f.alumnoRef} ${f.nombreAlumno}`, opts.q);
  });
}

export function ordenarTramites(filas: FilaTramiteSep[], orden: OrdenTramite): FilaTramiteSep[] {
  const copia = [...filas];
  const cmp = (a: FilaTramiteSep, b: FilaTramiteSep) => {
    switch (orden) {
      case 'reciente':
        return b.fecha.localeCompare(a.fecha);
      case 'nombre':
        return normalizarBusqueda(a.nombreAlumno).localeCompare(normalizarBusqueda(b.nombreAlumno), 'es');
      case 'control':
        return a.alumnoRef - b.alumnoRef;
      case 'porcentaje':
        return (b.porcentaje ?? -1) - (a.porcentaje ?? -1);
      case 'espera':
      default:
        // Quien lleva más tiempo esperando, primero (cola FIFO).
        return a.fecha.localeCompare(b.fecha);
    }
  };
  return copia.sort(cmp);
}

export function filtrarCuestionario(
  filas: FilaCuestionarioSep[],
  opts: { q: string; filtro: FiltroCuestionario }
): FilaCuestionarioSep[] {
  return filas.filter((f) => {
    if (opts.filtro === 'prueba' && !f.esPrueba) return false;
    if (opts.filtro !== 'prueba' && f.esPrueba && opts.filtro !== 'todas') return false;
    if (opts.filtro === 'sep' && (f.esPrueba || f.beneficio !== 'sep')) return false;
    if (opts.filtro === 'otra' && (f.esPrueba || f.beneficio !== 'otra')) return false;
    if (opts.filtro === 'no' && (f.esPrueba || f.aplico)) return false;
    if (opts.filtro === 'recibio' && (f.esPrueba || f.recibio !== true)) return false;
    if (opts.filtro === 'espera' && (f.esPrueba || f.recibio !== false)) return false;
    if (opts.filtro === 'sin_doc' && (f.esPrueba || f.beneficio !== 'sep' || f.recibio !== true || f.tieneTramite)) {
      return false;
    }
    if (opts.filtro === 'todas' && f.esPrueba) return false;
    const nombre = f.beneficio === 'otra' ? f.beneficioNombre ?? '' : '';
    return coincideBusqueda(`${f.alumnoRef ?? ''} ${nombre}`, opts.q);
  });
}

/** Prioridad operativa: primero quien ya recibió SEP y aún no sube documento. */
export function ordenarCuestionario(filas: FilaCuestionarioSep[]): FilaCuestionarioSep[] {
  const peso = (f: FilaCuestionarioSep) => {
    if (f.esPrueba) return 90;
    if (f.beneficio === 'sep' && f.recibio && !f.tieneTramite) return 0;
    if (f.beneficio === 'sep' && f.recibio) return 1;
    if (f.beneficio === 'sep') return 2;
    if (f.beneficio === 'otra' && f.recibio) return 3;
    if (f.beneficio === 'otra') return 4;
    return 5;
  };
  return [...filas].sort((a, b) => {
    const d = peso(a) - peso(b);
    if (d !== 0) return d;
    return (b.actualizadoEn ?? '').localeCompare(a.actualizadoEn ?? '');
  });
}

export function paginar<T>(filas: T[], pagina: number, porPagina = POR_PAGINA_SEP): { items: T[]; total: number; paginas: number; pagina: number } {
  const total = filas.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const p = Math.min(Math.max(1, pagina), paginas);
  const ini = (p - 1) * porPagina;
  return { items: filas.slice(ini, ini + porPagina), total, paginas, pagina: p };
}
