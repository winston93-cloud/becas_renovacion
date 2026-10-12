/**
 * 2026-10-07 - Control Escolar · Beca SEP: revisar documento, confirmar porcentaje, ver el cálculo
 * completo y Aplicar (o pedir corrección). Si ya está aplicada, muestra el cálculo guardado.
 * 2026-10-08 - Simplificado: documento a la izquierda; a la derecha una lista de sí/no, el monto mensual
 *              y los botones. La hoja de 8 pasos y el historial quedan en secciones desplegables.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Alert, Card } from '@/components/ui';
import { HojaCalculoVista, ListaAlertasSep } from '@/components/sep/HojaCalculoVista';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { NOMBRE_CONCEPTO, NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { armarHojaCalculo, type HojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { leerAdminSep } from '@/lib/sep/admin';
import { comparativoBecaColegio, sepMasCara } from '@/lib/sep/core/reversion';
import {
  calcularEnVivo,
  calcularReversionSep,
  contarPendientes,
  documentoVigente,
  ErrorSep,
  montoVigente,
  motivoNoPuedeTramitarRef,
  obtenerSep,
  porcentajeEfectivo,
  revisarPagosSep,
  siguientePendiente,
  type RevisionPagosSep,
} from '@/lib/sep/servicio';
import type { EstadoPagoSep } from '@/lib/sep/pagos';
import { siguienteCorreoPermitido } from '@/lib/sep/limitesCorreo';
import { esRefPruebaSep } from '@/lib/sep/activo';
import { resumenSimulacionPrueba } from '@/lib/sep/simulacionPrueba';
import type { DocumentoSep, SolicitudSep } from '@/lib/sep/tipos';
import {
  AccionesControlEscolar,
  AccionesReversion,
  AccionesSistemas,
  BotonAvisarPago,
  type PreviaReversion,
  type RenglonRevision,
  type ResumenRevision,
} from './AccionesSep';
import { AvisoListo } from '../AvisoListo';
import { BotonImprimirSep } from '../BotonImprimirSep';
import '../sep-panel.css';

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '—';

const ACTOR: Record<string, string> = {
  familia: 'Familia',
  ce_mk: 'CE Maternal y Kinder',
  ce_pri: 'CE Primaria',
  ce_sec: 'CE Secundaria',
  // 2026-10-09 - El rol "sistemas" se muestra como Dirección General.
  sistemas: 'Dirección General',
  sistema: 'Sistema',
};

/** 2026-10-09 - Pagos de colegiatura después de aplicar: de menos / de más contra la mensualidad SEP. */
// 2026-10-12 - Clases de insignia (admin-badge-estado) en lugar de solo color de texto.
const ESTADO_PAGO: Record<EstadoPagoSep, { texto: string; clase: string }> = {
  ok: { texto: 'Correcto', clase: 'admin-badge-estado--verificada' },
  menos: { texto: 'Pagó de menos', clase: 'admin-badge-estado--correccion' },
  mas: { texto: 'Pagó de más', clase: 'admin-badge-estado--espera-firma' },
  pendiente: { texto: 'Sin pago aún', clase: 'admin-badge-estado--borrador' },
  cubierto: { texto: 'Cubierto a mano', clase: 'admin-badge-estado--mes-normal' },
};

function PagosDespuesDeAplicar({
  id,
  r,
  avisos,
  libreDesde,
}: {
  id: string;
  r: RevisionPagosSep;
  avisos: number;
  libreDesde: string | null;
}) {
  if (!r.ok) return <p className="text-sm text-warning">{r.error}</p>;
  const { filas, conDiferencia, deMenos, deMas } = r.resumen;
  // 2026-10-12 - Sin meses que revisar no se muestra una tabla vacía que diga «coinciden».
  if (!filas.length) {
    return <p className="text-sm text-text-secondary">Todavía no hay meses de colegiatura que revisar después de aplicar la beca.</p>;
  }
  return (
    <div className="space-y-3">
      {conDiferencia.length ? (
        <Alert variant="warning" title="Hay diferencias en los pagos">
          {deMenos > 0 ? `Falta por pagar ${pesos(deMenos)}. ` : ''}
          {deMas > 0 ? `Pagó ${pesos(deMas)} de más. ` : ''}
          Los recargos no se cuentan.
        </Alert>
      ) : (
        <p className="text-sm text-success">Los pagos registrados coinciden con la mensualidad con Beca SEP.</p>
      )}
      {/* 2026-10-12 - Misma tabla (admin-table) e insignias que la lista de Beca SEP. */}
      <div className="admin-panel-card overflow-x-auto">
        <table className="admin-table sep-tabla-pagos">
          <thead>
            <tr>
              <th>Mes</th>
              <th className="text-right">Le corresponde</th>
              <th className="text-right">Pagó (sin recargos)</th>
              <th className="text-right">Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.concepto}>
                <td>{f.mes}</td>
                <td className="text-right tabular-nums">{pesos(f.esperado)}</td>
                <td className="text-right tabular-nums">{f.pagadoNeto != null ? pesos(f.pagadoNeto) : '—'}</td>
                <td className="text-right tabular-nums">
                  {f.diferencia != null && f.estado !== 'ok' ? `${f.diferencia > 0 ? '+' : '−'} ${pesos(Math.abs(f.diferencia))}` : '—'}
                </td>
                <td>
                  <span className={`admin-badge-estado ${ESTADO_PAGO[f.estado].clase}`}>{ESTADO_PAGO[f.estado].texto}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {conDiferencia.length ? (
        libreDesde ? (
          <p className="text-xs text-text-secondary">
            Ya se le avisó esta semana. Para no saturar a la familia, el siguiente aviso se puede enviar a partir del {libreDesde}.
          </p>
        ) : (
          <BotonAvisarPago id={id} avisos={avisos} />
        )
      ) : null}
    </div>
  );
}

/** 2026-10-12 - Estado del registro en el cobro: verde si ya quedó en alumno_beca_sep, ámbar si está pendiente. */
function DetalleCobro({ cobro }: { cobro: NonNullable<SolicitudSep['cobro']> }) {
  const ok = cobro.estado === 'aplicado';
  return (
    <p className={`rounded-lg px-3 py-2 text-xs ${ok ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'}`}>
      {ok ? '✓ ' : ''}
      {cobro.detalle}
    </p>
  );
}

const ESTADO_CE: Record<SolicitudSep['estado'], string> = {
  borrador: 'Esperando a la familia',
  enviada: 'Por revisar',
  correccion: 'Esperando a la familia',
  aplicada: 'Beca aplicada',
  rechazada: 'Rechazada',
  // 2026-10-12 - Dirección General autorizó regresar a la beca del colegio.
  revertida: 'Revertida',
};

/** 2026-10-12 - Mismas insignias que la lista (admin-badge-estado). */
const TONO: Record<SolicitudSep['estado'], string> = {
  borrador: 'admin-badge-estado--borrador',
  enviada: 'admin-badge-estado--pendiente',
  correccion: 'admin-badge-estado--correccion',
  aplicada: 'admin-badge-estado--activada',
  rechazada: 'admin-badge-estado--rechazada',
  revertida: 'admin-badge-estado--borrador',
};

/** Las tres preguntas que se haría la coordinación con el papel en la mano. */
function renglonesRevision(s: SolicitudSep, doc: DocumentoSep | null): RenglonRevision[] {
  if (!doc) return [];
  const d = doc.deteccion;
  if (!d.legible) {
    return [
      {
        ok: false,
        texto: 'Revise el documento a mano',
        detalle: 'Es un escaneo o una foto y el sistema no pudo leerlo. Revise usted que sea de la SEP, del alumno y el porcentaje.',
      },
    ];
  }
  return [
    d.pareceDocumentoSep
      ? { ok: true, texto: 'Es documento de la SEP', detalle: 'Menciona a la SEP y la beca.' }
      : { ok: false, texto: '¿Es documento de la SEP?', detalle: 'No menciona a la SEP y la beca. Revise el documento.' },
    d.coincideNombre
      ? { ok: true, texto: 'El nombre coincide con el alumno', detalle: s.nombreAlumno }
      : {
          ok: false,
          texto: '¿Es de este alumno?',
          detalle: d.nombreDetectado
            ? `El nombre del documento se parece poco: «${d.nombreDetectado}». Compárelo.`
            : `No se encontró «${s.nombreAlumno}» en el documento. Compárelo.`,
        },
    d.porcentajeDetectado != null
      ? { ok: true, texto: `Beca autorizada: ${d.porcentajeDetectado} %`, detalle: 'Confirme que es el porcentaje que dice el documento.' }
      : { ok: false, texto: 'Porcentaje no encontrado', detalle: 'Escríbalo abajo como viene en el documento.' },
  ];
}

const resumenDe = (h: HojaCalculo | null): ResumenRevision | null =>
  h ? { aplicaSep: h.aplicaSep, mensual: h.mensual, meses: h.mesesPorPagar, saldoFavor: h.saldoSobrante, conclusion: h.conclusion } : null;

export default async function AdminSepDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pct?: string; hecho?: string; de?: string }>;
}) {
  const admin = await leerAdminSep();
  if (!admin) redirect('/admin/login');
  let s: SolicitudSep;
  try {
    s = await obtenerSep(admin, (await params).id);
  } catch (e) {
    if (e instanceof ErrorSep && e.status === 404) notFound();
    return <Alert variant="error">{e instanceof Error ? e.message : 'Error'}</Alert>;
  }

  const { pct, hecho, de } = await searchParams;
  const doc = documentoVigente(s);
  const pctQuery = Number(pct);
  const pctVista = Number.isFinite(pctQuery) && pctQuery > 0 && pctQuery <= 100 ? pctQuery : porcentajeEfectivo(s);
  const aplicada = s.estado === 'aplicada' && s.calculo;
  // 2026-10-12 - Revertida: conserva el cálculo SEP (historial) y muestra el regreso a la beca del colegio.
  const revertida = s.estado === 'revertida' && s.calculo;
  const porRevisar = s.estado === 'enviada';
  // 2026-10-08 - La vista previa solo se calcula mientras se revisa; si se regresó a la familia o no ha
  //              enviado, no hay beca confirmada y mostrar un monto confunde.
  const vivo = porRevisar && pctVista != null ? await calcularEnVivo(s, pctVista) : null;
  const guardado = aplicada || revertida;
  const hoja = guardado ? armarHojaCalculo(s.calculo!.entrada) : vivo?.ok ? vivo.hoja : null;
  const alertas = guardado ? s.calculo!.alertas : vivo?.ok ? vivo.evaluacion.alertas : null;
  // 2026-10-09 - noInscrito: alumno dado de baja o sin inscripción en el ciclo; bloquea "Aplicar beca".
  // 2026-10-12 - previaReversion: cuánto pagaría si regresa a su beca del colegio (solo aplicadas).
  const [pendientes, siguienteId, noInscrito, revisionPagos, previaReversion] = await Promise.all([
    hecho ? contarPendientes(admin) : Promise.resolve(0),
    porRevisar ? siguientePendiente(admin, s.id) : Promise.resolve(null),
    porRevisar ? motivoNoPuedeTramitarRef(s.alumnoRef, s.ciclo).catch(() => null) : Promise.resolve(null),
    guardado ? revisarPagosSep(s) : Promise.resolve(null),
    aplicada ? calcularReversionSep(s) : Promise.resolve(null),
  ]);
  // 2026-10-12 - Aviso solo para el personal: la SEP le sale más cara que su beca del colegio.
  const comparativo = aplicada
    ? comparativoBecaColegio({
        colegiaturaOficial: s.calculo!.entrada.colegiaturaOficial,
        porcentajeColegio: s.becaSustituida?.porcentaje ?? s.calculo!.entrada.porcentajeBecaActual,
        mensualSep: montoVigente(s),
      })
    : vivo?.ok && vivo.evaluacion.colegiaturaOficial
      ? comparativoBecaColegio({
          colegiaturaOficial: vivo.evaluacion.colegiaturaOficial,
          porcentajeColegio: vivo.evaluacion.becaActualPct,
          mensualSep: vivo.hoja?.mensual,
        })
      : null;
  const avisoMasCara = sepMasCara(comparativo) ? (
    <Alert variant="warning" title="La Beca SEP le sale más cara a la familia (solo lo ve el personal)">
      Con su beca del colegio del {comparativo.porcentajeColegio} % pagaba {pesos(comparativo.precioColegio)} al mes; con la Beca SEP
      paga {pesos(comparativo.mensualSep)}: <strong>{pesos(comparativo.diferencia)} más cada mes</strong>.
      {aplicada ? ' Si conviene, solicite la reversión.' : ''}
    </Alert>
  ) : null;
  const previa: PreviaReversion | null =
    previaReversion?.ok
      ? { ...previaReversion.calculo, meses: previaReversion.calculo.porPagar.map((c) => NOMBRE_CONCEPTO[c] ?? c) }
      : null;
  const pendienteReversion =
    s.reversion?.estado === 'solicitada'
      ? { motivo: s.reversion.motivo, quien: ACTOR[s.reversion.solicitadaPor] ?? s.reversion.solicitadaPor, fecha: fecha(s.reversion.solicitadaEn) }
      : null;
  const avisosPago = s.historial.filter((e) => e.accion === 'aviso_pago' && e.correo?.enviado !== false).length;
  // 2026-10-09 - Un aviso de pagos por semana como máximo (anti-spam).
  const pagoLibre = siguienteCorreoPermitido('pago', s.historial);
  const bloqueos = [
    ...(noInscrito ? [noInscrito] : []),
    ...(alertas ?? []).filter((a) => a.nivel === 'bloqueante').map((a) => a.mensaje),
  ];

  return (
    <div className="space-y-5">
      <div className="sep-no-imprimir flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/sep" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a la lista
        </Link>
        {aplicada ? <BotonImprimirSep /> : null}
      </div>

      <div className="sep-no-imprimir">
        <AvisoListo hecho={hecho} de={de} pendientes={pendientes} />
      </div>

      <div className="admin-hero">
        <div className="flex flex-wrap items-center gap-3">
          <h2>{s.nombreAlumno}</h2>
          <span className={`admin-badge-estado ${TONO[s.estado]}`}>
            {s.estado === 'aplicada' ? '✓ ' : ''}
            {ESTADO_CE[s.estado]}
          </span>
          {esRefPruebaSep(s.alumnoRef) ? <span className="admin-badge-estado sep-badge--prueba">Prueba</span> : null}
        </div>
        <p>
          No. control {s.alumnoRef} · {s.nivel != null ? NOMBRE_NIVEL[s.nivel] ?? `Nivel ${s.nivel}` : 'Sin nivel'}
          {s.grado ? ` ${s.grado}°` : ''} · Ciclo {getSchoolCycleLabel(s.ciclo)}
          {s.enviadaEn ? ` · enviado ${fecha(s.enviadaEn)}` : ''}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="sep-no-imprimir space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Documento que subió la familia</h3>
            {doc ? (
              <a href={`/api/admin/sep/${s.id}/documento`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">
                Abrir en grande
              </a>
            ) : null}
          </div>
          {doc ? (
            <>
              {doc.tipo === 'application/pdf' ? (
                <iframe src={`/api/admin/sep/${s.id}/documento`} title="Documento SEP" className="h-[520px] w-full rounded-lg border border-border" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/admin/sep/${s.id}/documento`} alt="Documento SEP" className="max-h-[520px] w-full rounded-lg border border-border object-contain" />
              )}
              {s.documentos.length > 1 ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-text-secondary">Documentos anteriores ({s.documentos.length - 1})</summary>
                  <ul className="mt-2 space-y-1">
                    {s.documentos.slice(0, -1).map((d) => (
                      <li key={d.id}>
                        <a href={`/api/admin/sep/${s.id}/documento?doc=${d.id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {d.nombreOriginal}
                        </a>{' '}
                        · {fecha(d.subidoEn)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-text-secondary">La familia aún no sube documento.</p>
          )}
        </Card>

        <div className="space-y-5">
          {porRevisar && avisoMasCara ? <div className="sep-no-imprimir">{avisoMasCara}</div> : null}

          {porRevisar ? (
            <Card className="sep-no-imprimir">
              <AccionesControlEscolar
                id={s.id}
                nombre={s.nombreAlumno}
                renglones={renglonesRevision(s, doc)}
                porcentajeDetectado={s.porcentajeDetectado}
                porcentajeVista={pctVista}
                resumen={vivo?.ok ? resumenDe(vivo.hoja) : null}
                errorCalculo={vivo && !vivo.ok ? vivo.error : null}
                bloqueos={bloqueos}
                siguienteId={siguienteId}
                simulacion={esRefPruebaSep(s.alumnoRef) ? resumenSimulacionPrueba(s.alumnoRef) : null}
              />
            </Card>
          ) : null}

          {s.estado === 'correccion' ? (
            <Alert variant="warning" title="Esperando a la familia">
              Se le pidió otro documento: «{s.motivoCorreccion}». Cuando lo suba y lo envíe, volverá a aparecer en «Por revisar».
            </Alert>
          ) : null}

          {s.estado === 'borrador' ? (
            <Alert variant="info" title="Esperando a la familia">
              La familia subió un documento pero todavía no lo envía. No hay nada que hacer por ahora.
            </Alert>
          ) : null}

          {aplicada ? (
            <Card className="space-y-2">
              <p className="text-sm text-text-secondary">Beca SEP del {s.porcentajeConfirmado} % aplicada. La familia paga</p>
              <p className="text-2xl font-bold text-primary">{pesos(montoVigente(s))} al mes</p>
              {hoja?.mesesPorPagar.length ? (
                <p className="text-sm text-text-secondary">
                  {hoja.mesesPorPagar.length === 1
                    ? `en ${hoja.mesesPorPagar[0]}`
                    : `de ${hoja.mesesPorPagar[0]} a ${hoja.mesesPorPagar[hoja.mesesPorPagar.length - 1]} (${hoja.mesesPorPagar.length} meses)`}
                </p>
              ) : null}
              <p className="text-xs text-text-secondary">
                Aplicada {fecha(s.aplicadaEn)} por {ACTOR[s.revisadoPor ?? ''] ?? s.revisadoPor}
              </p>
              {s.ajusteManual ? (
                <p className="text-xs text-text-secondary">
                  Ajuste manual de Dirección General: {pesos(s.ajusteManual.monto)} — {s.ajusteManual.motivo}
                </p>
              ) : null}
              {s.becaSustituida ? (
                <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
                  Sustituye la beca {s.becaSustituida.clase ?? 'del colegio'} del {s.becaSustituida.porcentaje} %: no se renueva el
                  próximo ciclo; en Renovaciones aparece como «sustituida por SEP» y la familia debe hacer una Solicitud nueva.
                  {/* 2026-10-12 - La beca del alumno de prueba es de ejemplo y no llega a Renovaciones. */}
                  {esRefPruebaSep(s.alumnoRef) ? ' (Simulación: este alumno de prueba no aparece en Renovaciones.)' : null}
                </p>
              ) : null}
              {s.cobro ? <DetalleCobro cobro={s.cobro} /> : null}
              <a
                href={`/api/admin/sep/${s.id}/constancia`}
                target="_blank"
                rel="noreferrer"
                className="sep-no-imprimir inline-block text-xs font-semibold text-primary hover:underline"
              >
                Ver constancia PDF (la que recibió la familia por correo)
              </a>
            </Card>
          ) : null}

          {aplicada && avisoMasCara ? <div className="sep-no-imprimir">{avisoMasCara}</div> : null}

          {/* 2026-10-12 - Revertida: regreso a la beca del colegio autorizado por Dirección General. */}
          {revertida && s.reversion?.calculo ? (
            <Card className="space-y-2">
              <p className="text-sm text-text-secondary">
                Beca SEP revertida. Regresó a{' '}
                {s.reversion.calculo.porcentajeBeca > 0
                  ? `su beca ${s.reversion.calculo.claseBeca ?? 'del colegio'} del ${s.reversion.calculo.porcentajeBeca} %`
                  : 'la colegiatura sin beca'}{' '}
                y paga
              </p>
              <p className="text-2xl font-bold text-primary">
                {s.reversion.calculo.mensual == null ? 'Sin meses por cobrar' : `${pesos(s.reversion.calculo.mensual)} al mes`}
              </p>
              {s.reversion.calculo.porPagar.length ? (
                <p className="text-sm text-text-secondary">
                  {s.reversion.calculo.porPagar.length === 1
                    ? `en ${NOMBRE_CONCEPTO[s.reversion.calculo.porPagar[0]]}`
                    : `de ${NOMBRE_CONCEPTO[s.reversion.calculo.porPagar[0]]} a ${
                        NOMBRE_CONCEPTO[s.reversion.calculo.porPagar[s.reversion.calculo.porPagar.length - 1]]
                      } (${s.reversion.calculo.porPagar.length} meses)`}
                </p>
              ) : null}
              <p className="text-xs text-text-secondary">
                Motivo: «{s.reversion.motivo}». Solicitó {ACTOR[s.reversion.solicitadaPor] ?? s.reversion.solicitadaPor} ·
                autorizó {ACTOR[s.reversion.resueltaPor ?? ''] ?? s.reversion.resueltaPor} el {fecha(s.reversion.resueltaEn)}
              </p>
              <p className="text-xs text-text-secondary">
                La Beca SEP del {s.porcentajeConfirmado} % ({pesos(s.ajusteManual?.monto ?? s.calculo?.montoMensual ?? null)} al mes) ya no
                aplica; la beca del colegio se renueva normalmente.
              </p>
              {s.cobro ? <DetalleCobro cobro={s.cobro} /> : null}
            </Card>
          ) : null}

          {aplicada ? (
            <Card className="sep-no-imprimir space-y-3">
              <h3 className="text-sm font-semibold">Revertir Beca SEP</h3>
              <AccionesReversion
                id={s.id}
                esDireccion={admin.esSistemas}
                pendiente={pendienteReversion}
                previa={previa}
                errorPrevia={previaReversion && !previaReversion.ok ? previaReversion.error : null}
              />
            </Card>
          ) : null}

          {guardado && revisionPagos ? (
            <Card className="sep-no-imprimir space-y-3">
              <h3 className="text-sm font-semibold">{revertida ? 'Pagos contra lo que le corresponde' : 'Pagos después de aplicar'}</h3>
              <PagosDespuesDeAplicar
                id={s.id}
                r={revisionPagos}
                avisos={avisosPago}
                libreDesde={pagoLibre ? fecha(pagoLibre.toISOString()) : null}
              />
            </Card>
          ) : null}

          {aplicada && admin.esSistemas ? (
            <Card className="sep-no-imprimir">
              <h3 className="mb-3 text-sm font-semibold">Dirección General</h3>
              <AccionesSistemas id={s.id} tieneAjuste={!!s.ajusteManual} />
            </Card>
          ) : null}
        </div>
      </div>

      {hoja || (vivo?.ok && alertas?.length) ? (
        <details className="admin-panel-card group px-4 py-3" open={!!aplicada && admin.esSistemas}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary">
            <ChevronRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden />
            Ver cálculo detallado (opcional)
          </summary>
          <div className="mt-4 space-y-3">
            {hoja ? (
              <HojaCalculoVista
                h={hoja}
                alertas={alertas}
                montoVigente={guardado ? s.ajusteManual?.monto ?? s.calculo!.montoMensual : null}
                nota={
                  <p className="text-xs text-text-secondary">
                    {revertida
                      ? `Cálculo de la Beca SEP que se aplicó (${fecha(s.calculo!.calculadoEn)}); ya se revirtió.`
                      : aplicada
                      ? `Cálculo guardado al aplicar (${fecha(s.calculo!.calculadoEn)}).`
                      : esRefPruebaSep(s.alumnoRef)
                        ? `Vista previa con ${pctVista} %. Simulación: pagos y beca de ejemplo, no existen en InsForge.`
                        : `Vista previa con ${pctVista} %. Pagos sin recargos, leídos de InsForge (solo lectura).`}
                  </p>
                }
              />
            ) : alertas ? (
              <ListaAlertasSep alertas={alertas} />
            ) : null}
          </div>
        </details>
      ) : null}

      <details className="sep-no-imprimir admin-panel-card group px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-text-secondary">
          <ChevronRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden />
          Historial del trámite
        </summary>
        <ol className="mt-3 space-y-1 text-xs">
          {[...s.historial].reverse().map((e, i) => (
            <li key={i} className="border-b border-border py-1.5 last:border-0">
              <span className="text-text-secondary">{fecha(e.fecha)}</span> · <strong>{ACTOR[e.actor] ?? e.actor}</strong> ·{' '}
              {e.accion.replace(/_/g, ' ')}
              {e.detalle ? ` — ${e.detalle}` : ''}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
