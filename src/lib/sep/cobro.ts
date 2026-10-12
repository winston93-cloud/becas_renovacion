/**
 * 2026-10-07 - Punto único donde la Beca SEP aplicada llega al cobro (servicios_admin / baucher).
 * 2026-10-12 - Ya escribe: al aplicar, recalcular, ajustar o revertir se registra en alumno_beca_sep una fila
 *   por alumno y ciclo con la mensualidad de cada mes que falta (desglose.esperados). El baucher de
 *   servicios_admin cobra ese monto por concepto desde el ciclo 23; lo anterior a este módulo no se toca.
 *   Interruptor: BECAS_SEP_COBRO=1 lo enciende para todos; apagado, solo los alumnos de prueba.
 *   Revertida → estatus 'cancelada' con los montos de regreso a la beca del colegio (el baucher los respeta).
 *   Nunca tumba la acción principal: si falla, el trámite lo dice y "Recalcular" lo vuelve a intentar.
 */
import 'server-only';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { esModoLocalSoloLectura } from '@/lib/modo-local';
import { NOMBRE_CONCEPTO } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { esRefPruebaSep } from '@/lib/sep/activo';
import { folioSep } from '@/lib/sep/constancia';
import type { ActorSep, SolicitudSep } from '@/lib/sep/tipos';

const TABLA = 'alumno_beca_sep';
export const ORIGEN_COBRO_SEP = 'becas_renovacion';
const ORIGEN_PRUEBA = 'becas_renovacion_prueba';

export type CobroSep = NonNullable<SolicitudSep['cobro']>;

/** Cobro automático encendido para este alumno. */
export function cobroSepActivo(alumnoRef: number): boolean {
  return process.env.BECAS_SEP_COBRO === '1' || esRefPruebaSep(alumnoRef);
}

const ahora = () => new Date().toISOString();

function periodo(conceptos: string[]): string {
  if (!conceptos.length) return 'sin meses por cobrar';
  const n = (c: string) => NOMBRE_CONCEPTO[c] ?? c;
  return conceptos.length === 1 ? n(conceptos[0]) : `${n(conceptos[0])} a ${n(conceptos[conceptos.length - 1])} (${conceptos.length} meses)`;
}

/** Montos por mes que quedan por cobrar (los que el baucher usará). */
function montosPorCobrar(s: SolicitudSep): Record<string, number> {
  if (s.estado === 'revertida' && s.reversion?.calculo) {
    const m = s.reversion.calculo.mensual;
    return m == null ? {} : Object.fromEntries(s.reversion.calculo.porPagar.map((c) => [c, m]));
  }
  return s.esperados ?? {};
}

function filaCobro(s: SolicitudSep, actor: ActorSep) {
  const c = s.calculo!;
  const r = c.entrada.resultado;
  const revertida = s.estado === 'revertida';
  const esperados = { ...(s.esperados ?? {}), ...(revertida ? montosPorCobrar(s) : {}) };
  const prueba = esRefPruebaSep(s.alumnoRef);
  const mensual = revertida ? s.reversion?.calculo?.mensual ?? null : s.ajusteManual?.monto ?? c.montoMensual;
  return {
    alumno_id: s.alumnoId,
    alumno_ref: s.alumnoRef,
    ciclo_valor: s.ciclo,
    porcentaje_sep: s.porcentajeConfirmado ?? c.porcentajeSep,
    fecha_otorgamiento: (s.aplicadaEn ?? ahora()).slice(0, 10),
    estatus: revertida ? 'cancelada' : 'activa',
    plan_meses: c.entrada.planMeses,
    monto_mensual: mensual,
    estado_calculo: revertida ? 'revertida' : c.estado,
    monto_calculado: c.montoMensual,
    meses_pagados: r.mesesPagados,
    meses_restantes: r.mesesRestantes,
    excedente_colegiatura: r.excedenteColegiatura,
    excedente_inscripcion: r.excedenteInscripcion,
    desglose: {
      fuente: ORIGEN_COBRO_SEP,
      tramiteId: s.id,
      folio: folioSep(s),
      prueba,
      esperados,
      porCobrar: Object.keys(montosPorCobrar(s)),
      becaSustituida: s.becaSustituida ?? null,
      reversion: s.reversion ?? null,
    },
    calculado_en: c.calculadoEn,
    requiere_recalculo: false,
    anio_completo: revertida ? (s.reversion?.calculo?.mensual === 0) : r.anioCompleto,
    saldo_favor: revertida ? s.reversion?.calculo?.saldoFavor ?? 0 : c.saldoFavor,
    ajuste_manual_monto: revertida ? null : s.ajusteManual?.monto ?? null,
    ajuste_manual_motivo: revertida ? null : s.ajusteManual?.motivo ?? null,
    origen: prueba ? ORIGEN_PRUEBA : ORIGEN_COBRO_SEP,
    notas: prueba ? 'SIMULACIÓN DE PRUEBA: alumno de prueba, pagos de ejemplo.' : null,
    aprobado_por: actor,
    aprobado_en: s.aplicadaEn ?? ahora(),
    porcentaje_beca_actual: s.becaSustituida?.porcentaje ?? 0,
    actualizado_en: ahora(),
  };
}

/**
 * Registra (o actualiza) la Beca SEP del trámite en alumno_beca_sep y deja la huella en su historial.
 * `accion`: aplicar | recalcular | ajuste | revertir (va al historial del cobro).
 */
export async function registrarEnCobro(s: SolicitudSep, actor: ActorSep, accion: string): Promise<CobroSep> {
  const monto = s.ajusteManual?.monto ?? s.calculo?.montoMensual ?? null;
  const porCobrar = Object.keys(montosPorCobrar(s)).sort((a, b) => Number(a) - Number(b));
  if (!s.calculo) {
    return { estado: 'pendiente_integracion', detalle: 'No hay cálculo guardado: no se registró en cobro.', fecha: ahora() };
  }
  if (!cobroSepActivo(s.alumnoRef)) {
    return {
      estado: 'pendiente_integracion',
      detalle: `Cobro automático apagado (BECAS_SEP_COBRO): no se escribió en alumno_beca_sep. A cobrar ${pesos(monto)} por mes, ${periodo(porCobrar)}.`,
      fecha: ahora(),
    };
  }
  if (esModoLocalSoloLectura()) {
    return { estado: 'pendiente_integracion', detalle: 'Modo local: no se escribe en el cobro.', fecha: ahora() };
  }
  try {
    const db = getInsforgeAdmin().database;
    const { data: previas, error: e1 } = await db
      .from(TABLA)
      .select('*')
      .eq('alumno_id', s.alumnoId)
      .eq('ciclo_valor', s.ciclo)
      .limit(1);
    if (e1) throw e1;
    const previa = (previas ?? [])[0] as (Record<string, unknown> & { id: number; origen?: string }) | undefined;
    if (previa && !String(previa.origen ?? '').startsWith(ORIGEN_COBRO_SEP)) {
      return {
        estado: 'pendiente_integracion',
        detalle: `Ya existe una Beca SEP de otro origen (${previa.origen}) para este alumno y ciclo; no se sobrescribió. Avise a Sistemas.`,
        fecha: ahora(),
      };
    }
    const fila = filaCobro(s, actor);
    let id = previa?.id ?? null;
    if (previa) {
      const { error } = await db.from(TABLA).update(fila).eq('id', previa.id);
      if (error) throw error;
    } else {
      const { data, error } = await db.from(TABLA).insert([{ ...fila, creado_por: actor }]).select('id');
      if (error) throw error;
      id = (data?.[0] as { id?: number } | undefined)?.id ?? null;
    }
    const { error: eh } = await db.from(`${TABLA}_historial`).insert([
      {
        beca_sep_id: id,
        alumno_id: s.alumnoId,
        ciclo_valor: s.ciclo,
        accion: `becas_renovacion:${accion}`,
        datos_antes: previa ?? null,
        datos_despues: fila,
        usuario: actor,
      },
    ]);
    if (eh) console.error('[sep/cobro] historial', eh);
    const revertida = s.estado === 'revertida';
    const mensual = revertida ? s.reversion?.calculo?.mensual ?? null : monto;
    return {
      estado: 'aplicado',
      detalle: `${esRefPruebaSep(s.alumnoRef) ? 'SIMULACIÓN DE PRUEBA. ' : ''}Registrado en cobro${
        revertida ? ' (revertida: regresa a su beca del colegio)' : ''
      }: el baucher cobrará ${pesos(mensual)} por mes, ${periodo(porCobrar)}.`,
      fecha: ahora(),
    };
  } catch (e) {
    console.error('[sep/cobro]', e);
    return {
      estado: 'pendiente_integracion',
      detalle: `No se pudo registrar en cobro (${e instanceof Error ? e.message : 'error'}). Dirección General puede reintentar con «Recalcular».`,
      fecha: ahora(),
    };
  }
}