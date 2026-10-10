/**
 * 2026-10-07 - Hoja de cálculo Beca SEP (portada de BECAS-SEP-NUEVO /calculo/[id]).
 * Cada operación escrita: precio × %, restas, sumas, saldo a favor repartido entre los meses
 * por pagar y comprobación final. Sin estado: sirve para Control Escolar, Sistemas e impresión.
 */
import type { ReactNode } from 'react';
import type { Alerta } from '@/lib/sep/core/alertas';
import { pesos } from '@/lib/sep/core/dinero';
import type { HojaCalculo, Paso } from '@/lib/sep/core/hojaCalculo';
import { ETIQUETA_ESTADO } from '@/lib/sep/core/prorrateo';

const signo = (n: number) => (n < 0 ? `− ${pesos(Math.abs(n))}` : pesos(n));

function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`sep-hoja-paso space-y-3 rounded-[12px] border border-border bg-card p-5 shadow-card ${className}`}>
      {children}
    </section>
  );
}

export function ResultadoHoja({ h, montoVigente, nota }: { h: HojaCalculo; montoVigente?: number | null; nota?: ReactNode }) {
  const ajustado = montoVigente != null && h.mensual != null && montoVigente !== h.mensual;
  return (
    <Tarjeta className="border-t-4 border-t-primary">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">Resultado</h2>
        <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">
          {ETIQUETA_ESTADO[h.estado]}
        </span>
      </div>
      {h.aplicaSep ? (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p>
            <span className="font-display text-4xl font-semibold tabular-nums text-primary">
              {pesos(ajustado ? montoVigente : h.mensual)}
            </span>
            <span className="ml-2 text-sm text-text-secondary">al mes</span>
          </p>
          {h.saldoSobrante > 0 ? (
            <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
              + {pesos(h.saldoSobrante)} a favor para devolver
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="text-sm font-medium">{h.conclusion}</p>
      {ajustado ? (
        <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
          {/* 2026-10-09 - Sistemas ahora se llama Dirección General. */}
          Ajuste manual de Dirección General: {pesos(montoVigente)} al mes (la fórmula da {pesos(h.mensual)}).
        </p>
      ) : null}
      {nota}
    </Tarjeta>
  );
}

function PasoHoja({ paso, antes, despues }: { paso: Paso; antes?: ReactNode; despues?: ReactNode }) {
  return (
    <Tarjeta>
      <h2 className="flex items-center gap-3 text-sm font-semibold">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">
          {paso.numero}
        </span>
        {paso.titulo}
      </h2>
      {paso.explicacion ? <p className="text-xs text-text-secondary">{paso.explicacion}</p> : null}
      {antes}
      <table className="w-full text-sm">
        <tbody>
          {paso.renglones.map((r, i) => (
            <tr key={i} className={`border-b border-border last:border-0 ${r.destacado ? 'font-semibold' : ''}`}>
              <td className="py-2 pr-4 align-top">{r.texto}</td>
              <td className="py-2 pr-4 align-top font-mono text-xs tabular-nums text-text-secondary">{r.formula}</td>
              <td className={`whitespace-nowrap py-2 text-right align-top tabular-nums ${r.destacado ? 'text-primary' : ''}`}>
                {r.formula ? '= ' : ''}
                {r.resultado}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {paso.notas?.map((n, i) => (
        <p key={i} className="rounded-lg bg-bg px-3 py-2 text-xs">
          {n}
        </p>
      ))}
      {despues}
    </Tarjeta>
  );
}

function TablaMeses({ h }: { h: HojaCalculo }) {
  const t = h.totalesMeses;
  return (
    <div className="sep-hoja overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Fecha de pago</th>
            <th className="num">Pagado</th>
            <th className="num">− Recargo</th>
            <th className="num">= Neto</th>
            <th className="num">− Con SEP</th>
            <th className="num">= Saldo</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          {h.meses.map((m) => (
            <tr key={m.concepto} className={m.cuenta ? '' : 'opacity-50'}>
              <td className="font-medium">{m.nombre}</td>
              <td className="text-xs tabular-nums">{m.fecha || '—'}</td>
              <td className="num">{m.cubierto ? 'Cubierto' : pesos(m.pagado)}</td>
              <td className="num text-warning">{m.recargo > 0 ? `− ${pesos(m.recargo)}` : '—'}</td>
              <td className="num font-semibold">{pesos(m.neto)}</td>
              <td className="num text-text-secondary">{m.conSep != null ? `− ${pesos(m.conSep)}` : '—'}</td>
              <td className={`num font-semibold ${m.diferencia == null ? '' : m.diferencia >= 0 ? 'text-success' : 'text-error'}`}>
                {m.diferencia == null ? '—' : signo(m.diferencia)}
              </td>
              <td className="text-[11px] text-text-secondary">{m.nota}</td>
            </tr>
          ))}
          {!h.meses.length ? (
            <tr>
              <td colSpan={8} className="py-6 text-center text-text-secondary">
                Sin colegiaturas pagadas en el ciclo.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={2}>
              Suma de {t.contados} {t.contados === 1 ? 'mes' : 'meses'}
            </td>
            <td className="num">{pesos(t.pagado)}</td>
            <td className="num text-warning">{t.recargo > 0 ? `− ${pesos(t.recargo)}` : '—'}</td>
            <td className="num">{pesos(t.neto)}</td>
            <td className="num text-text-secondary">− {pesos(t.conSep)}</td>
            <td className="num text-primary">{signo(t.diferencia)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TablaReparto({ h }: { h: HojaCalculo }) {
  const t = h.totalesReparto!;
  return (
    <div className="sep-hoja overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Mes por pagar</th>
            <th className="num">Colegiatura con SEP</th>
            <th className="num">− Saldo a favor aplicado</th>
            <th className="num">= A pagar</th>
          </tr>
        </thead>
        <tbody>
          {h.reparto.map((f) => (
            <tr key={f.concepto}>
              <td className="font-medium">{f.nombre}</td>
              <td className="num">{pesos(f.conSep)}</td>
              <td className="num text-success">{signo(-f.abono)}</td>
              <td className="num font-semibold text-primary">{pesos(f.aPagar)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td>
              Total {h.reparto.length} {h.reparto.length === 1 ? 'mes' : 'meses'}
            </td>
            <td className="num">{pesos(t.conSep)}</td>
            <td className="num text-success">{signo(-t.abono)}</td>
            <td className="num text-primary">{pesos(t.aPagar)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Comprobacion({ c }: { c: NonNullable<HojaCalculo['comprobacion']> }) {
  const estado =
    c.diferencia === 0
      ? { clase: 'bg-success-bg text-success', texto: '✓ Cuadra al centavo.' }
      : c.cuadra
        ? { clase: 'bg-success-bg text-success', texto: `✓ Cuadra. Diferencia de ${signo(c.diferencia)}, explicada abajo.` }
        : { clase: 'bg-error-bg text-error', texto: `✕ No cuadra por ${signo(c.diferencia)}: revisar antes de aplicar.` };
  return (
    <Tarjeta>
      <h2 className="flex items-center gap-3 text-sm font-semibold">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">✓</span>
        Comprobación: lo pagado + lo que falta = costo anual con SEP
      </h2>
      <table className="w-full text-sm">
        <tbody>
          {c.renglones.map((r, i) => (
            <tr key={i} className={`border-b border-border last:border-0 ${r.destacado ? 'font-semibold' : ''}`}>
              <td className="py-2 pr-4">{r.texto}</td>
              <td className="py-2 pr-4 font-mono text-xs tabular-nums text-text-secondary">{r.formula}</td>
              <td className="whitespace-nowrap py-2 text-right tabular-nums">
                {r.formula ? '= ' : ''}
                {r.resultado}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`rounded-lg px-3 py-2 text-sm font-medium ${estado.clase}`}>{estado.texto}</p>
      {c.explicacion.map((x, i) => (
        <p key={i} className="text-xs">
          {x}
        </p>
      ))}
    </Tarjeta>
  );
}

export function ListaAlertasSep({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return <p className="text-sm text-text-secondary">Sin alertas.</p>;
  const tono: Record<Alerta['nivel'], string> = {
    bloqueante: 'bg-error-bg text-error',
    advertencia: 'bg-warning-bg text-warning',
    info: 'bg-primary-light text-primary',
  };
  return (
    <ul className="space-y-2">
      {alertas.map((a, i) => (
        <li key={`${a.codigo}-${i}`} className={`rounded-lg px-3 py-2 text-sm ${tono[a.nivel]}`}>
          {a.mensaje}
        </li>
      ))}
    </ul>
  );
}

/** Hoja completa: resultado, 8 pasos, comprobación, alertas y firmas. */
export function HojaCalculoVista({
  h,
  alertas,
  montoVigente,
  nota,
  firmas = true,
}: {
  h: HojaCalculo;
  alertas?: Alerta[] | null;
  montoVigente?: number | null;
  nota?: ReactNode;
  firmas?: boolean;
}) {
  return (
    <div className="space-y-4">
      <ResultadoHoja h={h} montoVigente={montoVigente} nota={nota} />
      {h.pasos.map((p) => (
        <PasoHoja
          key={p.numero}
          paso={p}
          antes={p.numero === 4 ? <TablaMeses h={h} /> : null}
          despues={p.numero === 8 && h.reparto.length > 0 ? <TablaReparto h={h} /> : null}
        />
      ))}
      {h.comprobacion ? <Comprobacion c={h.comprobacion} /> : null}
      {alertas && alertas.length > 0 ? (
        <Tarjeta className="sep-no-imprimir">
          <h2 className="text-sm font-semibold">Alertas del cálculo</h2>
          <ListaAlertasSep alertas={alertas} />
        </Tarjeta>
      ) : null}
      {firmas ? (
        <Tarjeta className="grid gap-8 pt-10 text-xs text-text-secondary sm:grid-cols-3">
          {['Revisó (nombre y firma)', 'Fecha de revisión', 'Aplicado en Servicios Administrativos'].map((t) => (
            <div key={t}>
              <div className="h-8 border-b border-text-secondary" />
              <p className="mt-1">{t}</p>
            </div>
          ))}
        </Tarjeta>
      ) : null}
    </div>
  );
}
