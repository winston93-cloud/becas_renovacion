/**
 * 2026-10-09 - Tablero de Dirección General · Beca SEP: cifras del ciclo a partir del informe (una sola
 * lectura de InsForge por alumno). Sin recordatorios: solo muestra el estado.
 */
import 'server-only';
import { r2 } from '@/lib/sep/core/dinero';
import { armarHojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { esperadosDeCalculo, revisarPagos, type ResumenPagos } from '@/lib/sep/pagos';
import type { FilaReporte } from '@/lib/sep/reporte';
import { montoVigente } from '@/lib/sep/servicio';
import type { EstadoSep, SolicitudSep } from '@/lib/sep/tipos';

export type ImpactoAlumno = {
  s: SolicitudSep;
  /** Mensualidad con la beca que tenía antes de la SEP (o sin beca). */
  antes: number;
  despues: number;
  meses: number;
  /** (antes − después) × meses: lo que el colegio deja de cobrar (negativo = cobra más). */
  impacto: number;
};

export type PagoConDiferencia = { s: SolicitudSep; resumen: ResumenPagos };

export type TableroSep = {
  total: number;
  porEstado: Record<EstadoSep, number>;
  porNivel: { nivel: number | null; total: number; porRevisar: number; aplicadas: number }[];
  porRevisar: number;
  /** Trámites enviados hace más de 3 días sin revisar. */
  porRevisarAtrasadas: number;
  aplicadas: number;
  impacto: { alumnos: ImpactoAlumno[]; mensualAntes: number; mensualDespues: number; totalMesesRestantes: number };
  becasSustituidas: { clase: string; total: number; porcentajes: number[] }[];
  pagos: { revisadas: number; conDiferencia: PagoConDiferencia[]; deMenos: number; deMas: number };
  correos: { enviados: number; avisosPago: number; sinCorreo: SolicitudSep[]; fallidos: number; omitidos: number };
};

const DIA = 24 * 60 * 60 * 1000;

function impactoDe(s: SolicitudSep): ImpactoAlumno | null {
  if (s.estado !== 'aplicada' || !s.calculo) return null;
  const e = s.calculo.entrada;
  const despues = montoVigente(s);
  if (despues == null) return null;
  const antes = r2(e.colegiaturaOficial * (1 - (e.porcentajeBecaActual ?? 0) / 100));
  const meses = armarHojaCalculo(e).mesesPorPagar.length;
  return { s, antes, despues, meses, impacto: r2((antes - despues) * meses) };
}

export function armarTablero(filas: FilaReporte[], ahora = Date.now()): TableroSep {
  const porEstado: Record<EstadoSep, number> = { borrador: 0, enviada: 0, correccion: 0, aplicada: 0, rechazada: 0 };
  const niveles = new Map<number | null, { total: number; porRevisar: number; aplicadas: number }>();
  const impactos: ImpactoAlumno[] = [];
  const sustituidas = new Map<string, number[]>();
  const conDiferencia: PagoConDiferencia[] = [];
  let revisadas = 0;
  const correos = { enviados: 0, avisosPago: 0, sinCorreo: [] as SolicitudSep[], fallidos: 0, omitidos: 0 };
  let atrasadas = 0;

  for (const f of filas) {
    const s = f.s;
    porEstado[s.estado] += 1;
    const n = niveles.get(s.nivel) ?? { total: 0, porRevisar: 0, aplicadas: 0 };
    n.total += 1;
    if (s.estado === 'enviada') {
      n.porRevisar += 1;
      if (s.enviadaEn && ahora - Date.parse(s.enviadaEn) > 3 * DIA) atrasadas += 1;
    }
    if (s.estado === 'aplicada') n.aplicadas += 1;
    niveles.set(s.nivel, n);

    const imp = impactoDe(s);
    if (imp) impactos.push(imp);

    if (s.estado === 'aplicada' && s.becaSustituida) {
      const clase = s.becaSustituida.clase ?? 'Sin clase registrada';
      sustituidas.set(clase, [...(sustituidas.get(clase) ?? []), s.becaSustituida.porcentaje]);
    }

    if (s.estado === 'aplicada' && s.calculo && f.pagos) {
      revisadas += 1;
      const resumen = revisarPagos(s.esperados ?? esperadosDeCalculo(s), f.pagos);
      if (resumen.conDiferencia.length) conDiferencia.push({ s, resumen });
    }

    let sinCorreo = false;
    for (const e of s.historial) {
      if (e.accion !== 'correo_familia' && e.accion !== 'aviso_pago') continue;
      const d = e.detalle ?? '';
      if (d.includes('no tiene correo')) sinCorreo = true;
      else if (d.startsWith('No se pudo')) correos.fallidos += 1;
      // 2026-10-09 - Correos que se detuvieron por el límite de frecuencia (anti-spam).
      else if (e.correo && !e.correo.enviado) correos.omitidos += 1;
      else if (e.accion === 'aviso_pago') correos.avisosPago += 1;
      else correos.enviados += 1;
    }
    if (sinCorreo) correos.sinCorreo.push(s);
  }

  return {
    total: filas.length,
    porEstado,
    porNivel: [...niveles.entries()]
      .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
      .map(([nivel, v]) => ({ nivel, ...v })),
    porRevisar: porEstado.enviada,
    porRevisarAtrasadas: atrasadas,
    aplicadas: porEstado.aplicada,
    impacto: {
      alumnos: impactos.sort((a, b) => b.impacto - a.impacto),
      mensualAntes: r2(impactos.reduce((t, i) => t + i.antes, 0)),
      mensualDespues: r2(impactos.reduce((t, i) => t + i.despues, 0)),
      totalMesesRestantes: r2(impactos.reduce((t, i) => t + i.impacto, 0)),
    },
    becasSustituidas: [...sustituidas.entries()]
      .map(([clase, porcentajes]) => ({ clase, total: porcentajes.length, porcentajes }))
      .sort((a, b) => b.total - a.total),
    pagos: {
      revisadas,
      conDiferencia,
      deMenos: r2(conDiferencia.reduce((t, p) => t + p.resumen.deMenos, 0)),
      deMas: r2(conDiferencia.reduce((t, p) => t + p.resumen.deMas, 0)),
    },
    correos,
  };
}
