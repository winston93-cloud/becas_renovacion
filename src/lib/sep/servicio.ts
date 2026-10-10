/**
 * 2026-10-07 - Reglas del trámite Beca SEP (familia → Control Escolar → Sistemas).
 * Lee alumnos, precios y pagos de InsForge en solo lectura; guarda el trámite en SepRepo.
 */
import 'server-only';
import { getCurrentSchoolCycle, getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { resolveBecasMailRecipients } from '@/lib/email-renovacion';
import { sendMail } from '@/lib/mailer';
import { evaluarBeca, type DatosAlumnoCiclo, type Evaluacion } from '@/lib/sep/core/evaluar';
import { armarHojaCalculo, entradaDesdeEvaluacion, type EntradaHoja, type HojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { alumnoPorRef, becaActualDetalle, datosAlumnoCiclo, type AlumnoBasico } from '@/lib/sep/insforge/consultas';
import { correoFamiliaSep } from '@/lib/sep/correosFamilia';
import { motivoNoEnviarCorreo } from '@/lib/sep/limitesCorreo';
import { actualizarEsperados, esperadosDeCalculo, revisarPagos, type ResumenPagos } from '@/lib/sep/pagos';
import { getLectorDocumento, MAX_BYTES_DOCUMENTO_SEP, TIPOS_DOCUMENTO_SEP } from '@/lib/sep/lectorDocumento';
import { aplicarEnCobro } from '@/lib/sep/cobro';
import { getSepRepo, nuevoIdSep } from '@/lib/sep/repo';
import { buzonPruebaSep, correosSepSoloPrueba, familiaPuedeUsarSep, MENSAJE_SEP_NO_DISPONIBLE } from '@/lib/sep/activo';
import {
  AVISO_OTRAS_BECAS,
  MAX_INTENTOS_DOCUMENTO,
  MENSAJE_LIMITE_DOCUMENTO_SEP,
  type ActorSep,
  type CalculoGuardado,
  type DocumentoSep,
  type EstadoSep,
  type EventoSep,
  type SolicitudSep,
} from '@/lib/sep/tipos';

export class ErrorSep extends Error {
  constructor(mensaje: string, readonly status = 400) {
    super(mensaje);
    this.name = 'ErrorSep';
  }
}

export const cicloSep = () => getCurrentSchoolCycle();

const ahora = () => new Date().toISOString();

function evento(actor: ActorSep, accion: EventoSep['accion'], detalle?: string): EventoSep {
  return { fecha: ahora(), actor, accion, ...(detalle ? { detalle } : {}) };
}

export const documentoVigente = (s: SolicitudSep): DocumentoSep | null =>
  s.documentos.length ? s.documentos[s.documentos.length - 1] : null;

/** Porcentaje con el que se calcula: el confirmado por CE o, si no, el detectado. */
export const porcentajeEfectivo = (s: SolicitudSep) => s.porcentajeConfirmado ?? s.porcentajeDetectado;

/** Monto mensual vigente: el ajuste manual de Sistemas o el del cálculo aplicado. */
export const montoVigente = (s: SolicitudSep) => s.ajusteManual?.monto ?? s.calculo?.montoMensual ?? null;

/** La familia puede enviar con documento válido, ilegible (revisión manual) o tras agotar intentos. */
export function puedeEnviar(s: SolicitudSep): boolean {
  if (s.estado !== 'borrador' && s.estado !== 'correccion') return false;
  const doc = documentoVigente(s);
  if (!doc) return false;
  return doc.deteccion.valido || !doc.deteccion.legible || s.intentosFallidos >= MAX_INTENTOS_DOCUMENTO;
}

/** Requiere revisión a mano de Control Escolar (no se pudo validar automáticamente). */
export function requiereRevisionManual(s: SolicitudSep): boolean {
  const doc = documentoVigente(s);
  return !!doc && !doc.deteccion.valido;
}

async function alumnoOError(ref: number): Promise<AlumnoBasico> {
  const a = await alumnoPorRef(ref);
  if (!a) throw new ErrorSep('No se encontró al alumno.', 404);
  return a;
}

/**
 * 2026-10-09 - Solo alumnos activos e inscritos en el ciclo vigente pueden tramitar Beca SEP.
 * Un ciclo mayor al vigente cuenta como inscrito (ya se reinscribió al siguiente).
 */
function causaNoInscrito(a: AlumnoBasico, ciclo: number): string | null {
  if (!a.activo) return 'El alumno aparece dado de baja (inactivo) en el colegio.';
  if (a.cicloAlumno == null || a.cicloAlumno < ciclo) {
    return `El alumno no está inscrito en el ciclo ${getSchoolCycleLabel(ciclo)}.`;
  }
  return null;
}

/** Mensaje para la familia; null si puede tramitar. */
export function motivoNoPuedeTramitar(a: AlumnoBasico, ciclo: number): string | null {
  const causa = causaNoInscrito(a, ciclo);
  return causa
    ? `${causa} Por eso no puede tramitar la Beca SEP. Si es un error, comuníquese con Control Escolar.`
    : null;
}

/** 2026-10-09 - Mensaje para Control Escolar, leyendo al alumno de InsForge; null si puede aplicarse. */
export async function motivoNoPuedeTramitarRef(ref: number, ciclo: number): Promise<string | null> {
  const a = await alumnoPorRef(ref);
  const causa = a ? causaNoInscrito(a, ciclo) : 'El número de control ya no existe en la base de alumnos.';
  return causa ? `${causa} No se puede aplicar la Beca SEP.` : null;
}

function exigirPuedeTramitar(a: AlumnoBasico) {
  const motivo = motivoNoPuedeTramitar(a, cicloSep());
  if (motivo) throw new ErrorSep(motivo, 403);
}

/** 2026-10-10 - Interruptor apagado: solo los alumnos de prueba pueden usar el trámite. */
function exigirSepDisponible(alumnoRef: number) {
  if (!familiaPuedeUsarSep(alumnoRef)) throw new ErrorSep(MENSAJE_SEP_NO_DISPONIBLE, 403);
}

// ---------------------------------------------------------------- Familia

export async function estadoFamilia(alumnoRef: number) {
  exigirSepDisponible(alumnoRef);
  const alumno = await alumnoOError(alumnoRef);
  const solicitud = await getSepRepo().porAlumno(alumno.alumnoId, cicloSep());
  return {
    alumno,
    ciclo: cicloSep(),
    solicitud,
    puedeEnviar: solicitud ? puedeEnviar(solicitud) : false,
    bloqueo: motivoNoPuedeTramitar(alumno, cicloSep()),
  };
}

export async function subirDocumento(alumnoRef: number, archivo: File, aceptaAviso: boolean) {
  exigirSepDisponible(alumnoRef);
  // 2026-10-08 - Sin la confirmación del aviso de pérdida de otras becas no se recibe el documento.
  if (!aceptaAviso) {
    throw new ErrorSep('Antes de subir el documento confirme que entiende que la beca SEP sustituye cualquier otra beca.');
  }
  if (!(TIPOS_DOCUMENTO_SEP as readonly string[]).includes(archivo.type)) {
    throw new ErrorSep('Solo se aceptan archivos PDF, JPG o PNG.');
  }
  // 2026-10-09 - Tope de 5 MB sin excepciones.
  if (archivo.size > MAX_BYTES_DOCUMENTO_SEP) throw new ErrorSep(MENSAJE_LIMITE_DOCUMENTO_SEP);
  if (archivo.size === 0) throw new ErrorSep('El archivo está vacío.');

  const repo = getSepRepo();
  const alumno = await alumnoOError(alumnoRef);
  exigirPuedeTramitar(alumno);
  const ciclo = cicloSep();
  const existente = await repo.porAlumno(alumno.alumnoId, ciclo);
  if (existente && existente.estado !== 'borrador' && existente.estado !== 'correccion') {
    throw new ErrorSep(
      existente.estado === 'enviada'
        ? 'Su documento ya se envió y está en revisión de Control Escolar.'
        : 'Este trámite ya fue resuelto por Control Escolar.',
      409
    );
  }

  const s: SolicitudSep = existente ?? {
    id: nuevoIdSep(),
    alumnoId: alumno.alumnoId,
    alumnoRef: alumno.alumnoRef,
    nombreAlumno: alumno.nombre,
    nivel: alumno.nivel,
    grado: alumno.grado,
    ciclo,
    estado: 'borrador',
    documentos: [],
    intentosFallidos: 0,
    porcentajeDetectado: null,
    porcentajeConfirmado: null,
    motivoCorreccion: null,
    enviadaEn: null,
    revisadaEn: null,
    revisadoPor: null,
    aplicadaEn: null,
    calculo: null,
    ajusteManual: null,
    cobro: null,
    historial: [],
    creadaEn: ahora(),
    actualizadaEn: ahora(),
  };

  const bytes = Buffer.from(await archivo.arrayBuffer());
  const deteccion = await getLectorDocumento().leer(bytes, archivo.type, alumno.nombre);
  const clave = await repo.guardarArchivo(s.id, archivo.name, bytes);
  const doc: DocumentoSep = {
    id: nuevoIdSep(),
    nombreOriginal: archivo.name.slice(0, 200),
    clave,
    tipo: archivo.type,
    tamano: archivo.size,
    subidoEn: ahora(),
    deteccion,
  };

  const fallido = deteccion.legible && !deteccion.valido;
  const guardada = await repo.guardar({
    ...s,
    nombreAlumno: alumno.nombre,
    nivel: alumno.nivel,
    grado: alumno.grado,
    documentos: [...s.documentos, doc],
    intentosFallidos: s.intentosFallidos + (fallido ? 1 : 0),
    porcentajeDetectado: deteccion.porcentajeDetectado,
    historial: [
      ...s.historial,
      evento('familia', 'aviso_aceptado', AVISO_OTRAS_BECAS),
      evento('familia', fallido ? 'documento_invalido' : 'documento_subido', `${doc.nombreOriginal} — ${deteccion.motivos.join(' ') || 'Documento reconocido.'}`),
    ],
  });
  return { solicitud: guardada, documento: doc, puedeEnviar: puedeEnviar(guardada) };
}

export async function enviarSolicitud(alumnoRef: number) {
  exigirSepDisponible(alumnoRef);
  const repo = getSepRepo();
  const alumno = await alumnoOError(alumnoRef);
  exigirPuedeTramitar(alumno);
  const s = await repo.porAlumno(alumno.alumnoId, cicloSep());
  if (!s) throw new ErrorSep('Primero suba el documento de autorización de la SEP.');
  if (!puedeEnviar(s)) {
    throw new ErrorSep(
      s.estado === 'enviada' ? 'Ya se envió; está en revisión.' : 'El documento no se pudo validar. Vuelva a subirlo o corríjalo.',
      409
    );
  }
  const guardada = await repo.guardar({
    ...s,
    estado: 'enviada',
    enviadaEn: ahora(),
    motivoCorreccion: null,
    historial: [...s.historial, evento('familia', 'enviada', requiereRevisionManual(s) ? 'Requiere revisión manual del documento.' : undefined)],
  });
  await avisarControlEscolar(guardada).catch((e) => console.error('[sep] aviso a Control Escolar', e));
  // 2026-10-09 - Sin correo de "recibido" a la familia (ya lo ve en pantalla): menos correos, menos riesgo de spam.
  return guardada;
}

/** 2026-10-09 - Agrega un evento (p. ej. el correo enviado) al historial y guarda. */
async function conEvento(s: SolicitudSep, ev: EventoSep): Promise<SolicitudSep> {
  return getSepRepo().guardar({ ...s, historial: [...s.historial, ev] });
}

/** 2026-10-08 - El aviso va a la coordinación del nivel del alumno (mismos buzones que Renovación/Solicitud). */
async function avisarControlEscolar(s: SolicitudSep) {
  // 2026-10-10 - Interruptor apagado: el aviso va al buzón de prueba, no a la coordinación.
  const destino = correosSepSoloPrueba() ? { to: buzonPruebaSep() } : resolveBecasMailRecipients(s.nivel);
  if (!destino) return;
  const nivel = s.nivel != null ? NOMBRE_NIVEL[s.nivel] ?? `Nivel ${s.nivel}` : 'Sin nivel';
  const pct = porcentajeEfectivo(s);
  await sendMail({
    ...destino,
    subject: `Beca SEP por validar: ${s.alumnoRef} ${s.nombreAlumno}`,
    html: `<p>La familia de <strong>${s.nombreAlumno}</strong> (No. de control ${s.alumnoRef}, ${nivel}) envió el documento de autorización de Beca SEP.</p>
<p>Porcentaje detectado: <strong>${pct != null ? `${pct} %` : 'no se detectó'}</strong>${requiereRevisionManual(s) ? ' — requiere revisión manual del documento' : ''}.</p>
<p>Revíselo en el panel de Control Escolar → Beca SEP y dé <strong>Aplicar</strong> si es correcto.</p>`,
  });
}

// ---------------------------------------------------------------- Cálculo

export type CalculoVivo =
  | { ok: true; datos: DatosAlumnoCiclo; evaluacion: Evaluacion; entrada: EntradaHoja | null; hoja: HojaCalculo | null }
  | { ok: false; error: string };

/** Cálculo completo con datos actuales de InsForge (pagos, precios, beca actual). */
export async function calcularEnVivo(s: SolicitudSep, porcentaje: number | null): Promise<CalculoVivo> {
  try {
    const datos = await datosAlumnoCiclo(s.alumnoRef, s.ciclo);
    if (!datos) return { ok: false, error: `El número de control ${s.alumnoRef} no existe en la base de alumnos.` };
    const evaluacion = evaluarBeca(datos, { porcentajeSep: porcentaje, porcentajeBecaActual: null, planMeses: null });
    const entrada = entradaDesdeEvaluacion(evaluacion, porcentaje);
    return { ok: true, datos, evaluacion, entrada, hoja: entrada ? armarHojaCalculo(entrada) : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer InsForge.' };
  }
}

function guardarCalculo(c: Extract<CalculoVivo, { ok: true }>, pct: number): CalculoGuardado {
  if (!c.entrada) throw new ErrorSep('Faltan datos para calcular (plan, precios o porcentaje).');
  return {
    entrada: c.entrada,
    porcentajeSep: pct,
    montoMensual: c.entrada.resultado.montoMensual,
    estado: c.entrada.resultado.estado,
    saldoFavor: c.entrada.resultado.saldoFavor,
    alertas: c.evaluacion.alertas,
    nivel: c.datos.nivelCiclo,
    calculadoEn: ahora(),
  };
}

export function validarPorcentaje(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100) throw new ErrorSep('El porcentaje debe estar entre 1 y 100.');
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- Control Escolar

export type AdminSep = { role: ActorSep; niveles: number[] };

const PENDIENTES: EstadoSep[] = ['enviada'];

export async function listarSep(admin: AdminSep, estados?: EstadoSep[]) {
  return getSepRepo().listar({ niveles: admin.niveles, estados, ciclo: cicloSep() });
}

export async function contarPendientes(admin: AdminSep): Promise<number> {
  try {
    return (await getSepRepo().listar({ niveles: admin.niveles, estados: PENDIENTES, ciclo: cicloSep() })).length;
  } catch {
    return 0;
  }
}

/** 2026-10-08 - Siguiente trámite por revisar del nivel (el más antiguo primero), sin contar el actual. */
export async function siguientePendiente(admin: AdminSep, idActual: string): Promise<string | null> {
  const pendientes = await getSepRepo().listar({ niveles: admin.niveles, estados: PENDIENTES, ciclo: cicloSep() });
  const siguiente = pendientes
    .filter((s) => s.id !== idActual)
    .sort((a, b) => (a.enviadaEn ?? '').localeCompare(b.enviadaEn ?? ''))[0];
  return siguiente?.id ?? null;
}

export async function obtenerSep(admin: AdminSep, id: string): Promise<SolicitudSep> {
  const s = await getSepRepo().obtener(id);
  if (!s) throw new ErrorSep('Trámite no encontrado.', 404);
  if (s.nivel == null || !admin.niveles.includes(s.nivel)) throw new ErrorSep('No tiene permiso para este nivel escolar.', 403);
  return s;
}

export async function aplicarSep(admin: AdminSep, id: string, porcentaje: unknown) {
  const s = await obtenerSep(admin, id);
  if (s.estado !== 'enviada') throw new ErrorSep('Solo se aplican trámites enviados por la familia.', 409);
  // 2026-10-09 - Si el alumno se dio de baja o no se reinscribió después de enviar, no se aplica.
  const noInscrito = await motivoNoPuedeTramitarRef(s.alumnoRef, s.ciclo);
  if (noInscrito) throw new ErrorSep(noInscrito, 409);
  const pct = validarPorcentaje(porcentaje);
  const c = await calcularEnVivo(s, pct);
  if (!c.ok) throw new ErrorSep(c.error, 502);
  const calculo = guardarCalculo(c, pct);
  const historial = [...s.historial];
  if (s.porcentajeDetectado !== pct) {
    historial.push(evento(admin.role, 'porcentaje_corregido', `${s.porcentajeDetectado ?? '—'} % → ${pct} %`));
  }
  const cobro = await aplicarEnCobro({ ...s, calculo, porcentajeConfirmado: pct });
  // 2026-10-09 - Movimiento para Renovaciones: la beca del colegio que se pierde (no se renueva el ciclo siguiente).
  const becaSustituida = await becaQueSePierde(s, c.evaluacion.becaActualPct);
  historial.push(
    evento(
      admin.role,
      'aplicada',
      `Beca SEP ${pct} %. Mensualidad ${pesos(calculo.montoMensual)}.${
        becaSustituida ? ` Sustituye la beca ${becaSustituida.clase ?? ''} ${becaSustituida.porcentaje} % (no se renueva).` : ''
      } ${cobro.detalle}`
    )
  );
  const guardada = await getSepRepo().guardar({
    ...s,
    estado: 'aplicada',
    porcentajeConfirmado: pct,
    revisadaEn: ahora(),
    revisadoPor: admin.role,
    aplicadaEn: ahora(),
    calculo,
    cobro,
    becaSustituida,
    esperados: esperadosDeCalculo({ calculo, ajusteManual: null }),
    historial,
  });
  // 2026-10-09 - Correo a la familia con el desglose, la constancia PDF y quién aplicó.
  return conEvento(guardada, await correoFamiliaSep('aplicada', guardada, { actor: admin.role }));
}

async function becaQueSePierde(s: SolicitudSep, pctEvaluado: number): Promise<SolicitudSep['becaSustituida']> {
  try {
    const b = await becaActualDetalle(s.alumnoId, s.ciclo);
    if (b) return { ...b, ciclo: s.ciclo };
  } catch (e) {
    console.error('[sep] beca actual', e);
  }
  return pctEvaluado > 0 && pctEvaluado < 100 ? { becaId: null, clase: null, porcentaje: pctEvaluado, ciclo: s.ciclo } : null;
}

export async function pedirCorreccionSep(admin: AdminSep, id: string, motivo: unknown) {
  const s = await obtenerSep(admin, id);
  if (s.estado !== 'enviada') throw new ErrorSep('Solo se pide corrección de trámites enviados.', 409);
  const texto = String(motivo ?? '').trim();
  if (texto.length < 5) throw new ErrorSep('Escriba el motivo de la corrección para la familia.');
  const guardada = await getSepRepo().guardar({
    ...s,
    estado: 'correccion',
    motivoCorreccion: texto.slice(0, 500),
    intentosFallidos: 0,
    revisadaEn: ahora(),
    revisadoPor: admin.role,
    historial: [...s.historial, evento(admin.role, 'correccion_solicitada', texto.slice(0, 500))],
  });
  // 2026-10-09 - La familia recibe el motivo por correo para subir el documento correcto.
  return conEvento(guardada, await correoFamiliaSep('correccion', guardada, { actor: admin.role }));
}

// ---------------------------------------------------------------- Sistemas

export async function listarTodasSep() {
  return getSepRepo().listar({ ciclo: cicloSep() });
}

export async function recalcularSep(admin: AdminSep, id: string) {
  const s = await obtenerSep(admin, id);
  if (s.estado !== 'aplicada') throw new ErrorSep('Solo se recalculan becas aplicadas.', 409);
  const pct = porcentajeEfectivo(s);
  if (pct == null) throw new ErrorSep('No hay porcentaje confirmado.');
  const c = await calcularEnVivo(s, pct);
  if (!c.ok) throw new ErrorSep(c.error, 502);
  const calculo = guardarCalculo(c, pct);
  const antes = s.calculo?.montoMensual ?? null;
  const guardada = await getSepRepo().guardar({
    ...s,
    calculo,
    // 2026-10-09 - Los meses ya pagados conservan lo esperado; los que faltan toman el monto nuevo.
    esperados: actualizarEsperados(s.esperados ?? esperadosDeCalculo(s), esperadosDeCalculo({ ...s, calculo }), c.datos.pagos),
    historial: [...s.historial, evento(admin.role, 'recalculada', `Mensualidad ${pesos(antes)} → ${pesos(calculo.montoMensual)}`)],
  });
  // 2026-10-09 - Solo se avisa a la familia si su mensualidad cambió (y no hay ajuste manual que la fije).
  if (guardada.ajusteManual || antes === calculo.montoMensual) return guardada;
  return conEvento(guardada, await correoFamiliaSep('actualizada', guardada, { por: admin.role, actor: admin.role }));
}

export async function ajusteManualSep(admin: AdminSep, id: string, monto: unknown, motivo: unknown) {
  const s = await obtenerSep(admin, id);
  if (s.estado !== 'aplicada') throw new ErrorSep('Solo se ajustan becas aplicadas.', 409);
  const texto = String(motivo ?? '').trim();
  if (texto.length < 10) throw new ErrorSep('El ajuste manual necesita un motivo (mínimo 10 caracteres).');
  const quitar = monto === '' || monto == null;
  const n = Number(monto);
  if (!quitar && (!Number.isFinite(n) || n < 0)) throw new ErrorSep('Monto inválido.');
  const tope = s.calculo?.entrada.colegiaturaOficial;
  if (!quitar && tope != null && n > tope) throw new ErrorSep(`El monto no puede superar la colegiatura oficial (${pesos(tope)}).`);
  const ajusteManual = quitar ? null : { monto: Math.round(n * 100) / 100, motivo: texto.slice(0, 500), por: admin.role, fecha: ahora() };
  const pagos = await pagosActuales(s);
  const guardada = await getSepRepo().guardar({
    ...s,
    ajusteManual,
    esperados: pagos
      ? actualizarEsperados(s.esperados ?? esperadosDeCalculo(s), esperadosDeCalculo({ ...s, ajusteManual }), pagos)
      : s.esperados,
    historial: [
      ...s.historial,
      evento(admin.role, 'ajuste_manual', quitar ? `Se quitó el ajuste. ${texto}` : `Mensualidad ajustada a ${pesos(n)}. ${texto}`),
    ],
  });
  // 2026-10-09 - La familia recibe el desglose vigente y la constancia actualizada.
  return conEvento(guardada, await correoFamiliaSep('actualizada', guardada, { por: admin.role, actor: admin.role }));
}

// ---------------------------------------------------------------- Pagos después de aplicar

/** 2026-10-09 - Pagos de colegiatura del ciclo en InsForge (null si no se pudo leer). */
async function pagosActuales(s: SolicitudSep) {
  try {
    return (await datosAlumnoCiclo(s.alumnoRef, s.ciclo))?.pagos ?? null;
  } catch (e) {
    console.error('[sep] pagos', e);
    return null;
  }
}

export type RevisionPagosSep = { ok: true; resumen: ResumenPagos } | { ok: false; error: string };

/** 2026-10-09 - Compara lo pagado desde que se aplicó la SEP contra la mensualidad esperada de cada mes. */
export async function revisarPagosSep(s: SolicitudSep): Promise<RevisionPagosSep> {
  if (s.estado !== 'aplicada' || !s.calculo) return { ok: false, error: 'La beca no está aplicada.' };
  const pagos = await pagosActuales(s);
  if (!pagos) return { ok: false, error: 'No se pudieron leer los pagos de InsForge.' };
  return { ok: true, resumen: revisarPagos(s.esperados ?? esperadosDeCalculo(s), pagos) };
}

/** 2026-10-09 - Control Escolar / Dirección General avisa por correo a la familia de pagos de menos o de más. */
export async function avisarPagoSep(admin: AdminSep, id: string) {
  const s = await obtenerSep(admin, id);
  const r = await revisarPagosSep(s);
  if (!r.ok) throw new ErrorSep(r.error, 409);
  if (!r.resumen.conDiferencia.length) throw new ErrorSep('Los pagos coinciden con la mensualidad: no hay nada que avisar.', 409);
  const noEnviar = motivoNoEnviarCorreo('pago', s.historial);
  if (noEnviar) throw new ErrorSep(`No se envió: ${noEnviar}.`, 409);
  return conEvento(s, await correoFamiliaSep('pago', s, { pagos: r.resumen, actor: admin.role }));
}
