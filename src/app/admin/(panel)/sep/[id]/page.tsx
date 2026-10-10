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
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { armarHojaCalculo, type HojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { leerAdminSep } from '@/lib/sep/admin';
import {
  calcularEnVivo,
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
import type { DocumentoSep, SolicitudSep } from '@/lib/sep/tipos';
import {
  AccionesControlEscolar,
  AccionesSistemas,
  BotonAvisarPago,
  type RenglonRevision,
  type ResumenRevision,
} from './AccionesSep';
import { AvisoListo } from '../AvisoListo';
import { BotonImprimirSep } from '../BotonImprimirSep';

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
const ESTADO_PAGO: Record<EstadoPagoSep, { texto: string; clase: string }> = {
  ok: { texto: 'Correcto', clase: 'text-success' },
  menos: { texto: 'Pagó de menos', clase: 'font-semibold text-error' },
  mas: { texto: 'Pagó de más', clase: 'font-semibold text-warning' },
  pendiente: { texto: 'Sin pago aún', clase: 'text-text-secondary' },
  cubierto: { texto: 'Cubierto a mano', clase: 'text-text-secondary' },
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-secondary">
              <th className="py-1.5 pr-3">Mes</th>
              <th className="py-1.5 pr-3 text-right">Le corresponde</th>
              <th className="py-1.5 pr-3 text-right">Pagó (sin recargos)</th>
              <th className="py-1.5 pr-3 text-right">Diferencia</th>
              <th className="py-1.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.concepto} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-3">{f.mes}</td>
                <td className="py-1.5 pr-3 text-right">{pesos(f.esperado)}</td>
                <td className="py-1.5 pr-3 text-right">{f.pagadoNeto != null ? pesos(f.pagadoNeto) : '—'}</td>
                <td className="py-1.5 pr-3 text-right">
                  {f.diferencia != null && f.estado !== 'ok' ? `${f.diferencia > 0 ? '+' : '−'} ${pesos(Math.abs(f.diferencia))}` : '—'}
                </td>
                <td className={`py-1.5 ${ESTADO_PAGO[f.estado].clase}`}>{ESTADO_PAGO[f.estado].texto}</td>
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

const ESTADO_CE: Record<SolicitudSep['estado'], string> = {
  borrador: 'Esperando a la familia',
  enviada: 'Por revisar',
  correccion: 'Esperando a la familia',
  aplicada: 'Beca aplicada',
  rechazada: 'Rechazada',
};

const TONO: Record<SolicitudSep['estado'], string> = {
  borrador: 'bg-bg text-text-secondary',
  enviada: 'bg-warning-bg text-warning',
  correccion: 'bg-warning-bg text-warning',
  aplicada: 'bg-success-bg text-success',
  rechazada: 'bg-error-bg text-error',
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
  const porRevisar = s.estado === 'enviada';
  // 2026-10-08 - La vista previa solo se calcula mientras se revisa; si se regresó a la familia o no ha
  //              enviado, no hay beca confirmada y mostrar un monto confunde.
  const vivo = porRevisar && pctVista != null ? await calcularEnVivo(s, pctVista) : null;
  const hoja = aplicada ? armarHojaCalculo(s.calculo!.entrada) : vivo?.ok ? vivo.hoja : null;
  const alertas = aplicada ? s.calculo!.alertas : vivo?.ok ? vivo.evaluacion.alertas : null;
  // 2026-10-09 - noInscrito: alumno dado de baja o sin inscripción en el ciclo; bloquea "Aplicar beca".
  const [pendientes, siguienteId, noInscrito, revisionPagos] = await Promise.all([
    hecho ? contarPendientes(admin) : Promise.resolve(0),
    porRevisar ? siguientePendiente(admin, s.id) : Promise.resolve(null),
    porRevisar ? motivoNoPuedeTramitarRef(s.alumnoRef, s.ciclo).catch(() => null) : Promise.resolve(null),
    aplicada ? revisarPagosSep(s) : Promise.resolve(null),
  ]);
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
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONO[s.estado]}`}>{ESTADO_CE[s.estado]}</span>
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
                </p>
              ) : null}
              {s.cobro ? <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">{s.cobro.detalle}</p> : null}
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

          {aplicada && revisionPagos ? (
            <Card className="sep-no-imprimir space-y-3">
              <h3 className="text-sm font-semibold">Pagos después de aplicar</h3>
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
                montoVigente={aplicada ? montoVigente(s) : null}
                nota={
                  <p className="text-xs text-text-secondary">
                    {aplicada
                      ? `Cálculo guardado al aplicar (${fecha(s.calculo!.calculadoEn)}).`
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
