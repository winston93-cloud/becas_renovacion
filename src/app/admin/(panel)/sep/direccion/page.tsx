/**
 * 2026-10-09 - Dirección General · Beca SEP (antes "Reporte de Sistemas"): tablero del ciclo
 * (trámites, impacto en colegiaturas, becas sustituidas, pagos con diferencia, correos) y debajo el informe
 * detallado por alumno con el Excel de fórmulas. Sin recordatorios a familias.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { Alert, Card } from '@/components/ui';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { leerAdminSep } from '@/lib/sep/admin';
import { reporteSistemas } from '@/lib/sep/reporte';
import { cicloSep } from '@/lib/sep/servicio';
import { armarTablero } from '@/lib/sep/tablero';
import { MAX_CORREOS_24H } from '@/lib/sep/limitesCorreo';
import { ETIQUETA_ESTADO_SEP } from '@/lib/sep/tipos';

export const dynamic = 'force-dynamic';

const nivelTxt = (n: number | null) => (n != null ? NOMBRE_NIVEL[n] ?? `Nivel ${n}` : 'Sin nivel');

function Cifra({ titulo, valor, nota, tono }: { titulo: string; valor: string | number; nota?: string; tono?: 'warning' | 'error' | 'success' }) {
  const color = tono === 'warning' ? 'text-warning' : tono === 'error' ? 'text-error' : tono === 'success' ? 'text-success' : 'text-primary';
  return (
    <Card className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{titulo}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{valor}</p>
      {nota ? <p className="text-xs text-text-secondary">{nota}</p> : null}
    </Card>
  );
}

export default async function DireccionSepPage() {
  const admin = await leerAdminSep();
  if (!admin) redirect('/admin/login');
  if (!admin.esSistemas) {
    return <Alert variant="warning">Esta sección es solo para Dirección General.</Alert>;
  }
  const filas = await reporteSistemas();
  const t = armarTablero(filas);
  const aplicadas = filas.filter((f) => f.s.estado === 'aplicada');
  const conDiferencia = aplicadas.filter((f) => f.diferencia != null && Math.abs(f.diferencia) >= 0.01);
  const conBloqueantes = filas.filter((f) => f.alertas.some((a) => a.nivel === 'bloqueante'));
  const imp = t.impacto.totalMesesRestantes;

  return (
    <div className="space-y-5">
      <Link href="/admin/sep" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Beca SEP
      </Link>

      <div className="admin-hero">
        <h2>Dirección General · Beca SEP</h2>
        <p>
          Ciclo {getSchoolCycleLabel(cicloSep())} · {t.total} trámite(s) · {t.aplicadas} aplicada(s)
        </p>
        <p className="text-xs text-text-secondary">
          Cifras con los pagos registrados hoy en InsForge (solo lectura). Las familias reciben por correo el desglose y
          la constancia al aplicarse su beca; aquí no se envían recordatorios.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          titulo="Por revisar"
          valor={t.porRevisar}
          nota={t.porRevisarAtrasadas ? `${t.porRevisarAtrasadas} con más de 3 días esperando` : 'Control Escolar al día'}
          tono={t.porRevisarAtrasadas ? 'warning' : undefined}
        />
        <Cifra
          titulo="Becas SEP aplicadas"
          valor={t.aplicadas}
          nota={`${t.porEstado.correccion} esperando corrección · ${t.porEstado.borrador} sin enviar`}
          tono="success"
        />
        <Cifra
          titulo={imp >= 0 ? 'Colegiatura que se deja de cobrar' : 'Colegiatura adicional'}
          valor={pesos(Math.abs(imp))}
          nota={`Meses que faltan del ciclo. Al mes: ${pesos(t.impacto.mensualAntes)} antes → ${pesos(t.impacto.mensualDespues)} con SEP`}
          tono={imp > 0 ? 'warning' : undefined}
        />
        <Cifra
          titulo="Pagos con diferencia"
          valor={t.pagos.conDiferencia.length}
          nota={
            [
              t.pagos.deMenos ? `Faltan ${pesos(t.pagos.deMenos)}` : '',
              t.pagos.deMas ? `De más ${pesos(t.pagos.deMas)}` : '',
              `${t.pagos.revisadas} becas revisadas`,
            ]
              .filter(Boolean)
              .join(' · ')
          }
          tono={t.pagos.conDiferencia.length ? 'error' : undefined}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">Trámites por nivel</h3>
          {t.porNivel.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  <th className="py-1">Nivel</th>
                  <th className="py-1 text-right">Total</th>
                  <th className="py-1 text-right">Por revisar</th>
                  <th className="py-1 text-right">Aplicadas</th>
                </tr>
              </thead>
              <tbody>
                {t.porNivel.map((n) => (
                  <tr key={String(n.nivel)} className="border-t border-border">
                    <td className="py-1">{nivelTxt(n.nivel)}</td>
                    <td className="py-1 text-right tabular-nums">{n.total}</td>
                    <td className={`py-1 text-right tabular-nums ${n.porRevisar ? 'font-semibold text-warning' : ''}`}>{n.porRevisar}</td>
                    <td className="py-1 text-right tabular-nums">{n.aplicadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-text-secondary">Sin trámites.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">Becas del colegio sustituidas</h3>
          {t.becasSustituidas.length ? (
            <>
              <ul className="space-y-1 text-sm">
                {t.becasSustituidas.map((b) => (
                  <li key={b.clase} className="flex justify-between gap-2 border-b border-border py-1 last:border-0">
                    <span>{b.clase}</span>
                    <span className="tabular-nums text-text-secondary">
                      {b.total} · {[...new Set(b.porcentajes)].sort((x, y) => x - y).join(', ')} %
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-text-secondary">
                No se renuevan el próximo ciclo; en Renovaciones aparecen como «sustituida por SEP» y la familia debe hacer
                Solicitud nueva.
              </p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">Ningún alumno con beca SEP aplicada tenía otra beca del colegio.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">Correos a familias</h3>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between">
              <span>Avisos del trámite enviados</span>
              <span className="tabular-nums">{t.correos.enviados}</span>
            </li>
            <li className="flex justify-between">
              <span>Avisos de pagos enviados</span>
              <span className="tabular-nums">{t.correos.avisosPago}</span>
            </li>
            <li className={`flex justify-between ${t.correos.fallidos ? 'text-error' : ''}`}>
              <span>Con error al enviar</span>
              <span className="tabular-nums">{t.correos.fallidos}</span>
            </li>
            <li className="flex justify-between text-text-secondary">
              <span>Detenidos para no saturar a la familia</span>
              <span className="tabular-nums">{t.correos.omitidos}</span>
            </li>
          </ul>
          <p className="text-xs text-text-secondary">
            Máximo {MAX_CORREOS_24H} correos por familia al día y un aviso de pagos por semana (la confirmación de beca
            aplicada siempre se envía).
          </p>
          {t.correos.sinCorreo.length ? (
            <div className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
              <p className="font-semibold">Sin correo registrado ({t.correos.sinCorreo.length}):</p>
              <p>
                {t.correos.sinCorreo.map((s, i) => (
                  <span key={s.id}>
                    {i ? ', ' : ''}
                    <Link href={`/admin/sep/${s.id}`} className="underline">
                      {s.nombreAlumno}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </Card>
      </section>

      {t.pagos.conDiferencia.length ? (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold">Familias que pagaron de menos o de más</h3>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>No. Control</th>
                  <th>Alumno</th>
                  <th>Meses con diferencia</th>
                  <th className="text-right">Faltan</th>
                  <th className="text-right">De más</th>
                  <th>Avisado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {t.pagos.conDiferencia.map(({ s, resumen }) => {
                  const avisos = s.historial.filter((e) => e.accion === 'aviso_pago').length;
                  return (
                    <tr key={s.id}>
                      <td className="font-semibold">{s.alumnoRef}</td>
                      <td>{s.nombreAlumno}</td>
                      <td className="text-sm">{resumen.conDiferencia.map((f) => f.mes).join(', ')}</td>
                      <td className="text-right tabular-nums text-error">{resumen.deMenos ? pesos(resumen.deMenos) : '—'}</td>
                      <td className="text-right tabular-nums text-warning">{resumen.deMas ? pesos(resumen.deMas) : '—'}</td>
                      <td className="text-sm">{avisos ? `Sí (${avisos})` : 'No'}</td>
                      <td>
                        <Link href={`/admin/sep/${s.id}`} className="font-semibold text-primary hover:underline">
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {t.impacto.alumnos.length ? (
        <details className="admin-panel-card group px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            Impacto por alumno ({t.impacto.alumnos.length})
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th className="text-right">Antes (al mes)</th>
                  <th className="text-right">Con SEP (al mes)</th>
                  <th className="text-right">Meses</th>
                  <th className="text-right">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {t.impacto.alumnos.map((i) => (
                  <tr key={i.s.id}>
                    <td>
                      <Link href={`/admin/sep/${i.s.id}`} className="text-primary hover:underline">
                        {i.s.nombreAlumno}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{pesos(i.antes)}</td>
                    <td className="text-right tabular-nums">{pesos(i.despues)}</td>
                    <td className="text-right tabular-nums">{i.meses}</td>
                    <td className={`text-right tabular-nums ${i.impacto > 0 ? 'text-warning' : 'text-success'}`}>
                      {i.impacto >= 0 ? '−' : '+'} {pesos(Math.abs(i.impacto))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-text-secondary">
              «Antes» = colegiatura oficial con la beca que tenía el alumno (o sin beca). «−» el colegio cobra menos; «+» cobra
              más (perdió una beca mayor que la SEP).
            </p>
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <h3 className="mr-auto text-base font-semibold">Informe detallado por alumno</h3>
        {/* Descarga de archivo, no navegación entre páginas. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/admin/sep/excel"
          className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Download className="h-4 w-4" aria-hidden /> Excel de cálculos (con fórmulas)
        </a>
        {conDiferencia.length ? (
          <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">
            {conDiferencia.length} con diferencia contra lo aplicado
          </span>
        ) : null}
        {conBloqueantes.length ? (
          <span className="rounded-full bg-error-bg px-3 py-1 text-xs font-semibold text-error">
            {conBloqueantes.length} con alertas bloqueantes
          </span>
        ) : null}
      </div>

      {filas.length === 0 ? (
        <Card className="text-sm text-text-secondary">Todavía no hay trámites de Beca SEP en este ciclo.</Card>
      ) : (
        <div className="admin-panel-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>No. Control</th>
                <th>Alumno</th>
                <th>Nivel</th>
                <th>Estado</th>
                <th className="text-right">% SEP</th>
                <th className="text-right">Cálculo de hoy</th>
                <th className="text-right">Aplicado</th>
                <th className="text-right">Diferencia</th>
                <th>Alertas</th>
                <th>Hoja</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const bloqueantes = f.alertas.filter((a) => a.nivel === 'bloqueante').length;
                const avisos = f.alertas.length - bloqueantes;
                return (
                  <tr key={f.s.id}>
                    <td className="font-semibold">{f.s.alumnoRef}</td>
                    <td>{f.s.nombreAlumno}</td>
                    <td>{f.nivel != null ? NOMBRE_NIVEL[f.nivel] ?? f.nivel : '—'}</td>
                    <td className="text-sm">{ETIQUETA_ESTADO_SEP[f.s.estado]}</td>
                    <td className="text-right tabular-nums">{f.pct != null ? `${f.pct} %` : '—'}</td>
                    <td className="text-right tabular-nums">
                      {f.error && f.calculadoHoy == null ? (
                        <span className="text-error" title={f.error}>
                          Error
                        </span>
                      ) : (
                        pesos(f.calculadoHoy)
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {pesos(f.aplicado)}
                      {f.s.ajusteManual ? <span className="ml-1 text-xs text-warning">(ajuste)</span> : null}
                    </td>
                    <td className={`text-right tabular-nums ${f.diferencia ? 'font-semibold text-warning' : ''}`}>
                      {f.diferencia == null ? '—' : f.diferencia === 0 ? '✓' : pesos(f.diferencia)}
                    </td>
                    <td className="text-xs">
                      {bloqueantes ? <span className="text-error">{bloqueantes} bloqueante(s) </span> : null}
                      {avisos ? <span className="text-text-secondary">{avisos} aviso(s)</span> : null}
                      {!f.alertas.length ? '—' : null}
                    </td>
                    <td>
                      <Link href={`/admin/sep/${f.s.id}`} className="font-semibold text-primary hover:underline">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
