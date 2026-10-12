'use client';

/**
 * 2026-10-12 - Cola de trabajo Beca SEP: cifras que filtran, búsqueda, orden FIFO y tabla paginada.
 * Pensado para decenas de familias sin recargar la página ni hacer scroll infinito.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import {
  POR_PAGINA_SEP,
  VISTAS_TRAMITE,
  filtrarCuestionario,
  filtrarTramites,
  gradosDeTramites,
  ordenarCuestionario,
  ordenarTramites,
  paginar,
  type FilaCuestionarioSep,
  type FilaTramiteSep,
  type FiltroCuestionario,
  type OrdenTramite,
  type ResumenBxPanel,
  type SeccionSep,
  type VistaTramite,
} from '@/lib/sep/panelLista';
import { AvisoListo } from './AvisoListo';
import './sep-panel.css';

const nivelTxt = (n: number | null) => (n != null ? NOMBRE_NIVEL[n] ?? `Nivel ${n}` : 'Sin nivel');
const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—';

const FILTROS_BX: { valor: FiltroCuestionario; texto: string }[] = [
  { valor: 'todas', texto: 'Reales' },
  { valor: 'sin_doc', texto: 'SEP sin documento' },
  { valor: 'sep', texto: 'Beca SEP' },
  { valor: 'recibio', texto: 'Ya la recibieron' },
  { valor: 'espera', texto: 'En espera' },
  { valor: 'otra', texto: 'Otra beca' },
  { valor: 'no', texto: 'No aplicaron' },
  { valor: 'prueba', texto: 'Prueba' },
];

type Props = {
  tramites: FilaTramiteSep[];
  cuestionario: FilaCuestionarioSep[];
  resumen: ResumenBxPanel | null;
  esSistemas: boolean;
  hecho?: string;
  de?: string;
  vistaInicial?: VistaTramite;
};

export function PanelSep({ tramites, cuestionario, resumen, esSistemas, hecho, de, vistaInicial = 'revisar' }: Props) {
  const [seccion, setSeccion] = useState<SeccionSep>('tramites');
  const [vista, setVista] = useState<VistaTramite>(vistaInicial);
  const [q, setQ] = useState('');
  const [grado, setGrado] = useState<number | null>(null);
  const [orden, setOrden] = useState<OrdenTramite>('espera');
  const [soloManual, setSoloManual] = useState(false);
  const [filtroBx, setFiltroBx] = useState<FiltroCuestionario>('todas');
  const [pagina, setPagina] = useState(1);

  const grados = useMemo(() => gradosDeTramites(tramites), [tramites]);
  const conteoVista = (v: VistaTramite) => tramites.filter((f) => VISTAS_TRAMITE.find((x) => x.valor === v)?.estados.includes(f.estado)).length;
  const pendientes = conteoVista('revisar');
  const sinDoc = cuestionario.filter((f) => !f.esPrueba && f.beneficio === 'sep' && f.recibio === true && !f.tieneTramite).length;

  const tramitesVisibles = useMemo(
    () => ordenarTramites(filtrarTramites(tramites, { vista, q, grado, soloManual }), orden),
    [tramites, vista, q, grado, soloManual, orden]
  );
  const bxVisibles = useMemo(
    () => ordenarCuestionario(filtrarCuestionario(cuestionario, { q, filtro: filtroBx })),
    [cuestionario, q, filtroBx]
  );

  const paginaTramites = useMemo(() => paginar(tramitesVisibles, pagina), [tramitesVisibles, pagina]);
  const paginaBx = useMemo(() => paginar(bxVisibles, pagina), [bxVisibles, pagina]);
  const paginaActual = seccion === 'tramites' ? paginaTramites : paginaBx;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      document.getElementById('sep-buscar')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const vacioTramite = VISTAS_TRAMITE.find((v) => v.valor === vista)?.vacio ?? 'Sin trámites.';
  const vacio =
    seccion === 'tramites'
      ? tramitesVisibles.length === 0
        ? q || grado != null || soloManual
          ? 'Ningún trámite coincide con esos filtros.'
          : vacioTramite
        : null
      : bxVisibles.length === 0
        ? q
          ? 'Ninguna respuesta coincide con la búsqueda.'
          : 'Todavía no contesta ninguna familia.'
        : null;

  return (
    <div className="sep-panel">
      <AvisoListo hecho={hecho} de={de} pendientes={pendientes} />

      <div className="sep-chips" role="tablist" aria-label="Qué quiere revisar">
        <button type="button" role="tab" aria-selected={seccion === 'tramites'} className={`sep-chip${seccion === 'tramites' ? ' is-activa' : ''}`} onClick={() => { setSeccion('tramites'); setPagina(1); }}>
          Documentos
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'cuestionario'} className={`sep-chip${seccion === 'cuestionario' ? ' is-activa' : ''}`} onClick={() => { setSeccion('cuestionario'); setPagina(1); }}>
          Cuestionario{resumen ? ` (${resumen.contestaron})` : ''}
        </button>
        {esSistemas ? (
          <Link href="/admin/sep/direccion" className="sep-link-dg">
            Dirección General
          </Link>
        ) : null}
      </div>

      {seccion === 'tramites' ? (
        <div className="sep-kpis">
          {VISTAS_TRAMITE.map((v) => (
            <button
              key={v.valor}
              type="button"
              className={`sep-kpi${vista === v.valor ? ' is-activa' : ''}`}
              onClick={() => {
                setVista(v.valor);
                setPagina(1);
              }}
            >
              <span className="sep-kpi-num">{conteoVista(v.valor)}</span>
              <span className="sep-kpi-txt">{v.texto}</span>
            </button>
          ))}
          <button type="button" className={`sep-kpi${soloManual ? ' is-activa' : ''}`} onClick={() => { setSoloManual((x) => !x); setPagina(1); }}>
            <span className="sep-kpi-num">{tramites.filter((f) => f.revisionManual && f.estado === 'enviada').length}</span>
            <span className="sep-kpi-txt">Revisar a mano</span>
          </button>
        </div>
      ) : (
        <div className="sep-kpis">
          <button type="button" className={`sep-kpi${filtroBx === 'todas' ? ' is-activa' : ''}`} onClick={() => { setFiltroBx('todas'); setPagina(1); }}>
            <span className="sep-kpi-num">{resumen?.contestaron ?? 0}</span>
            <span className="sep-kpi-txt">Contestaron</span>
          </button>
          <button type="button" className={`sep-kpi${filtroBx === 'sep' ? ' is-activa' : ''}${sinDoc ? ' is-urgente' : ''}`} onClick={() => { setFiltroBx('sep'); setPagina(1); }}>
            <span className="sep-kpi-num">{resumen?.sep.total ?? 0}</span>
            <span className="sep-kpi-txt">Beca SEP</span>
          </button>
          <button type="button" className={`sep-kpi${filtroBx === 'sin_doc' ? ' is-activa' : ''}${sinDoc ? ' is-urgente' : ''}`} onClick={() => { setFiltroBx('sin_doc'); setPagina(1); }}>
            <span className="sep-kpi-num">{sinDoc}</span>
            <span className="sep-kpi-txt">SEP sin documento</span>
          </button>
          <button type="button" className={`sep-kpi${filtroBx === 'otra' ? ' is-activa' : ''}`} onClick={() => { setFiltroBx('otra'); setPagina(1); }}>
            <span className="sep-kpi-num">{resumen?.otra.total ?? 0}</span>
            <span className="sep-kpi-txt">Otra beca</span>
          </button>
        </div>
      )}

      <div className="sep-toolbar">
        <div className="sep-campo sep-campo--buscar">
          <label htmlFor="sep-buscar">Buscar</label>
          <input
            id="sep-buscar"
            className="ui-control"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(1);
            }}
            placeholder="Nombre o no. de control…"
            autoComplete="off"
          />
        </div>
        {seccion === 'tramites' ? (
          <>
            <div className="sep-campo">
              <label htmlFor="sep-grado">Grado</label>
              <select id="sep-grado" className="ui-control ui-select" value={grado ?? ''} onChange={(e) => { setGrado(e.target.value ? Number(e.target.value) : null); setPagina(1); }}>
                <option value="">Todos</option>
                {grados.map((g) => (
                  <option key={g} value={g}>{g}°</option>
                ))}
              </select>
            </div>
            <div className="sep-campo">
              <label htmlFor="sep-orden">Orden</label>
              <select id="sep-orden" className="ui-control ui-select" value={orden} onChange={(e) => { setOrden(e.target.value as OrdenTramite); setPagina(1); }}>
                <option value="espera">Más tiempo esperando</option>
                <option value="reciente">Más reciente</option>
                <option value="nombre">Nombre A–Z</option>
                <option value="control">No. de control</option>
                <option value="porcentaje">Mayor porcentaje</option>
              </select>
            </div>
          </>
        ) : (
          <div className="sep-campo">
            <label htmlFor="sep-bx">Respuesta</label>
            <select id="sep-bx" className="ui-control ui-select" value={filtroBx} onChange={(e) => { setFiltroBx(e.target.value as FiltroCuestionario); setPagina(1); }}>
              {FILTROS_BX.map((f) => (
                <option key={f.valor} value={f.valor}>{f.texto}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="sep-meta">
        <p>
          {paginaActual.total === 0
            ? '0 resultados'
            : `Mostrando ${(paginaActual.pagina - 1) * POR_PAGINA_SEP + 1}–${Math.min(paginaActual.pagina * POR_PAGINA_SEP, paginaActual.total)} de ${paginaActual.total}`}
          {seccion === 'tramites' && orden === 'espera' ? ' · primero quien lleva más tiempo' : null}
        </p>
        {seccion === 'cuestionario' && resumen?.otra.nombres.length ? (
          <p>Otras becas: {resumen.otra.nombres.map((n) => `${n.nombre} (${n.total})`).join(', ')}</p>
        ) : null}
      </div>

      {vacio ? (
        <p className="sep-vacio">{!resumen && seccion === 'cuestionario' ? 'No se pudieron leer las respuestas. Intente más tarde.' : vacio}</p>
      ) : seccion === 'tramites' ? (
        <ListaTramites filas={paginaTramites.items} />
      ) : (
        <ListaCuestionario filas={paginaBx.items} />
      )}

      {paginaActual.paginas > 1 ? (
        <div className="sep-pagina">
          <button type="button" disabled={paginaActual.pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <span>
            Página {paginaActual.pagina} de {paginaActual.paginas}
          </span>
          <button type="button" disabled={paginaActual.pagina >= paginaActual.paginas} onClick={() => setPagina((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ListaTramites({ filas }: { filas: FilaTramiteSep[] }) {
  return (
    <>
      <div className="sep-tabla-caja">
        <table className="admin-table">
          <thead>
            <tr>
              <th>No. control</th>
              <th>Alumno</th>
              <th>Grado</th>
              <th>Beca</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((s) => (
              <tr key={s.id} className={s.revisionManual ? 'is-urgente' : undefined}>
                <td className="tabular-nums">{s.alumnoRef}</td>
                <td>{s.nombreAlumno}</td>
                <td>{s.grado ? `${s.grado}°` : nivelTxt(s.nivel)}</td>
                <td>{s.porcentaje != null ? `${s.porcentaje} %` : '—'}</td>
                <td>
                  <EstadoTramite s={s} />
                </td>
                <td>{fechaCorta(s.fecha)}</td>
                <td>
                  <Link href={`/admin/sep/${s.id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                    {s.estado === 'enviada' ? 'Revisar' : 'Ver'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sep-cards">
        {filas.map((s) => (
          <Link key={s.id} href={`/admin/sep/${s.id}`} className={`sep-card${s.revisionManual ? ' is-urgente' : ''}`}>
            <strong>{s.nombreAlumno}</strong>
            <small>
              {s.alumnoRef} · {s.grado ? `${s.grado}°` : nivelTxt(s.nivel)} · {s.porcentaje != null ? `${s.porcentaje} %` : 'sin %'}
            </small>
            <EstadoTramite s={s} />
          </Link>
        ))}
      </div>
    </>
  );
}

function EstadoTramite({ s }: { s: FilaTramiteSep }) {
  if (s.estado === 'enviada') {
    return (
      <span className={`sep-badge${s.revisionManual ? ' sep-badge--aviso' : ''}`}>
        {s.revisionManual ? 'Revisar a mano' : 'Por revisar'}
      </span>
    );
  }
  if (s.estado === 'aplicada') {
    return <span className="sep-badge sep-badge--ok">{s.monto != null ? pesos(s.monto) : 'Aplicada'}</span>;
  }
  return <span className="sep-badge sep-badge--aviso">{s.estado === 'correccion' ? 'Otro documento' : 'Sin enviar'}</span>;
}

function ListaCuestionario({ filas }: { filas: FilaCuestionarioSep[] }) {
  return (
    <>
      <div className="sep-tabla-caja">
        <table className="admin-table">
          <thead>
            <tr>
              <th>No. control</th>
              <th>Nivel</th>
              <th>Beca</th>
              <th>Situación</th>
              <th>Respondió</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const urgente = f.beneficio === 'sep' && f.recibio === true && !f.tieneTramite && !f.esPrueba;
              return (
                <tr key={`${f.alumnoRef}-${i}`} className={urgente ? 'is-urgente' : undefined}>
                  <td className="tabular-nums">{f.alumnoRef ?? '—'}</td>
                  <td>{nivelTxt(f.alumnoNivel)}</td>
                  <td>{becaTxt(f)}</td>
                  <td>
                    <SituacionBx f={f} urgente={urgente} />
                  </td>
                  <td>{fechaCorta(f.actualizadoEn)}</td>
                  <td>
                    {f.tramiteId ? (
                      <Link href={`/admin/sep/${f.tramiteId}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                        Ver trámite
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sep-cards">
        {filas.map((f, i) => {
          const urgente = f.beneficio === 'sep' && f.recibio === true && !f.tieneTramite && !f.esPrueba;
          return f.tramiteId ? (
            <Link key={`${f.alumnoRef}-${i}`} href={`/admin/sep/${f.tramiteId}`} className={`sep-card${urgente ? ' is-urgente' : ''}`}>
              <strong>No. control {f.alumnoRef ?? '—'}</strong>
              <small>{nivelTxt(f.alumnoNivel)} · {becaTxt(f)}</small>
              <SituacionBx f={f} urgente={urgente} />
            </Link>
          ) : (
            <div key={`${f.alumnoRef}-${i}`} className={`sep-card${urgente ? ' is-urgente' : ''}`}>
              <strong>No. control {f.alumnoRef ?? '—'}</strong>
              <small>{nivelTxt(f.alumnoNivel)} · {becaTxt(f)}</small>
              <SituacionBx f={f} urgente={urgente} />
            </div>
          );
        })}
      </div>
    </>
  );
}

function becaTxt(f: FilaCuestionarioSep) {
  if (!f.aplico) return 'Ninguna';
  if (f.beneficio === 'sep') return 'Beca SEP';
  return f.beneficioNombre?.trim() || 'Otra beca';
}

function SituacionBx({ f, urgente }: { f: FilaCuestionarioSep; urgente: boolean }) {
  if (f.esPrueba) return <span className="sep-badge sep-badge--prueba">Prueba</span>;
  if (urgente) return <span className="sep-badge sep-badge--aviso">Ya la recibió · falta documento</span>;
  if (!f.aplico) return <span className="sep-badge">No aplicó</span>;
  if (f.tieneTramite) return <span className="sep-badge sep-badge--ok">Ya hay trámite</span>;
  if (f.recibio) return <span className="sep-badge sep-badge--aviso">Ya la recibió</span>;
  return <span className="sep-badge">En espera</span>;
}
