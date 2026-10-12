/**
 * 2026-10-12 - Lo que contestan las familias en "Beneficios externos" (servicios escolares):
 * cuántas aplicaron a la Beca SEP u otra beca externa, aunque todavía no suban su documento.
 */
import { Card } from '@/components/ui';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import type { ResumenBeneficiosExternos } from '@/lib/sep/beneficiosExternos';

const nivelTxt = (n: number | null) => (n != null ? NOMBRE_NIVEL[n] ?? `Nivel ${n}` : 'Sin nivel');

function Cifra({ titulo, valor, nota }: { titulo: string; valor: number; nota: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-3">
      <p className="text-xs text-text-secondary">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-text-secondary">{nota}</p>
    </div>
  );
}

export function ResumenBeneficiosExternos({ r }: { r: ResumenBeneficiosExternos | null }) {
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Beneficios externos · lo que contestan las familias</h3>
        <p className="text-xs text-text-secondary">
          Respuestas del cuestionario en servicios escolares, antes de subir cualquier documento.
          {r?.dePrueba ? ` No se cuentan ${r.dePrueba} de prueba.` : ''}
        </p>
      </div>

      {!r ? (
        <p className="text-sm text-warning">No se pudieron leer las respuestas. Intente más tarde.</p>
      ) : r.contestaron === 0 ? (
        <p className="text-sm text-text-secondary">Todavía no contesta ninguna familia.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cifra titulo="Contestaron" valor={r.contestaron} nota={`${r.noAplicaron} no aplicaron a ninguna`} />
            <Cifra titulo="Aplicaron a una beca externa" valor={r.aplicaron} nota="Beca SEP u otra" />
            <Cifra
              titulo="Beca SEP"
              valor={r.sep.total}
              nota={`${r.sep.recibida} ya la recibieron · ${r.sep.enEspera} en espera`}
            />
            <Cifra
              titulo="Otra beca externa"
              valor={r.otra.total}
              nota={`${r.otra.recibida} ya la recibieron · ${r.otra.enEspera} en espera`}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {r.porNivel.length > 1 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-secondary">
                    <th className="py-1">Nivel</th>
                    <th className="py-1 text-right">Contestaron</th>
                    <th className="py-1 text-right">Aplicaron</th>
                    <th className="py-1 text-right">Beca SEP</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porNivel.map((n) => (
                    <tr key={String(n.nivel)} className="border-t border-border">
                      <td className="py-1">{nivelTxt(n.nivel)}</td>
                      <td className="py-1 text-right tabular-nums">{n.contestaron}</td>
                      <td className="py-1 text-right tabular-nums">{n.aplicaron}</td>
                      <td className="py-1 text-right tabular-nums">{n.sep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {r.otra.nombres.length ? (
              <div className="text-sm">
                <p className="text-xs text-text-secondary">Otras becas que mencionan</p>
                <ul className="mt-1 space-y-0.5">
                  {r.otra.nombres.map((o) => (
                    <li key={o.nombre} className="flex justify-between gap-3">
                      <span className="truncate">{o.nombre}</span>
                      <span className="tabular-nums">{o.total}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}
