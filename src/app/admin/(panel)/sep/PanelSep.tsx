'use client';

/**
 * 2026-10-12 - Cola de trabajo Beca SEP: cifras que filtran, búsqueda, orden FIFO y tabla paginada.
 * Pensado para decenas de familias sin recargar la página ni hacer scroll infinito.
 * 2026-10-12 - Mismo formato que «Solicitudes nuevas»: buscador + selectores, admin-table,
 * insignias admin-badge-estado, filas verdes al aplicar y tarjetas en celular.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Card, Input, Select } from '@/components/ui';
import { AdminExportListaButtons } from '@/components/admin/AdminExportListaButtons';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import {
  POR_PAGINA_SEP,
  VISTAS_TRAMITE,
  filtrarCuestionario,
  filtrarTramites,
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
const gradoTxt = (g: number | null, n: number | null) => (g ? `${g}° de ${nivelTxt(n)}` : nivelTxt(n));
const fechaLarga = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-MX') : '—');
const enlace = 'font-semibold text-primary underline-offset-2 hover:underline';
const enlaceAccion = `inline-flex min-h-[44px] items-center ${enlace}`;

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
  gradosDisponibles?: number[];
};

export function PanelSep({ tramites, cuestionario, resumen, esSistemas, hecho, de, vistaInicial = 'revisar', gradosDisponibles = [] }: Props) {
  const [seccion, setSeccion] = useState<SeccionSep>('tramites');
  const [vista, setVista] = useState<VistaTramite>(vistaInicial);
  const [q, setQ] = useState('');
  const [grado, setGrado] = useState<number | null>(null);
  const [orden, setOrden] = useState<OrdenTramite>('espera');
  const [soloManual, setSoloManual] = useState(false);
  const [filtroBx, setFiltroBx] = useState<FiltroCuestionario>('todas');
  const [pagina, setPagina] = useState(1);
  const buscarRef = useRef<HTMLInputElement>(null);

  const conteoVista = (v: VistaTramite) => tramites.filter((f) => VISTAS_TRAMITE.find((x) => x.valor === v)?.estados.includes(f.estado)).length;
  const pendientes = conteoVista('revisar');
  const aMano = tramites.filter((f) => f.revisionManual && f.estado === 'enviada').length;
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
      buscarRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const irA = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  const filtroTexto = [
    soloManual ? 'Revisar a mano' : VISTAS_TRAMITE.find((v) => v.valor === vista)?.texto,
    grado != null ? `${grado}° grado` : null,
    q.trim() ? `«${q.trim()}»` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const vacioTramite = VISTAS_TRAMITE.find((v) => v.valor === vista)?.vacio ?? 'Sin trámites.';
  const vacio =
    seccion === 'tramites'
      ? tramitesVisibles.length === 0
        ? q || grado != null || soloManual
          ? 'Ningún trámite coincide con esos filtros.'
          : vacioTramite
        : null
      : !resumen
        ? 'No se pudieron leer las respuestas. Intente más tarde.'
        : bxVisibles.length === 0
          ? q
            ? 'Ninguna respuesta coincide con la búsqueda.'
            : 'Todavía no contesta ninguna familia.'
          : null;

  return (
    <div className="space-y-4">
      <AvisoListo hecho={hecho} de={de} pendientes={pendientes} />

      <div className="sep-tabs-fila">
        <div className="sep-tabs" role="tablist" aria-label="Qué quiere revisar">
          <button type="button" role="tab" aria-selected={seccion === 'tramites'} className={`sep-tab${seccion === 'tramites' ? ' is-activa' : ''}`} onClick={() => irA(() => setSeccion('tramites'))}>
            Documentos <span className="sep-tab-num">{tramites.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={seccion === 'cuestionario'} className={`sep-tab${seccion === 'cuestionario' ? ' is-activa' : ''}`} onClick={() => irA(() => setSeccion('cuestionario'))}>
            Cuestionario <span className="sep-tab-num">{resumen?.contestaron ?? 0}</span>
          </button>
        </div>
        {esSistemas ? (
          <Link href="/admin/sep/direccion" className={enlace}>
            Dirección General →
          </Link>
        ) : null}
      </div>

      {seccion === 'tramites' ? (
        <div className="sep-resumen">
          {VISTAS_TRAMITE.map((v) => (
            <Cifra key={v.valor} activa={vista === v.valor && !soloManual} num={conteoVista(v.valor)} texto={v.texto} onClick={() => irA(() => { setVista(v.valor); setSoloManual(false); })} />
          ))}
          <Cifra activa={soloManual} aviso={aMano > 0} num={aMano} texto="Revisar a mano" onClick={() => irA(() => { setVista('revisar'); setSoloManual((x) => !x); })} />
        </div>
      ) : (
        <div className="sep-resumen">
          <Cifra activa={filtroBx === 'todas'} num={resumen?.contestaron ?? 0} texto="Contestaron" onClick={() => irA(() => setFiltroBx('todas'))} />
          <Cifra activa={filtroBx === 'sep'} num={resumen?.sep.total ?? 0} texto="Beca SEP" onClick={() => irA(() => setFiltroBx('sep'))} />
          <Cifra activa={filtroBx === 'sin_doc'} aviso={sinDoc > 0} num={sinDoc} texto="SEP sin documento" onClick={() => irA(() => setFiltroBx('sin_doc'))} />
          <Cifra activa={filtroBx === 'otra'} num={resumen?.otra.total ?? 0} texto="Otra beca" onClick={() => irA(() => setFiltroBx('otra'))} />
        </div>
      )}

      {/* 2026-10-12 - Barra con flex-wrap: buscador + Excel/PDF + 3 filtros no caben en una línea y los botones se encimaban. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="relative w-full max-w-md lg:min-w-[14rem] lg:flex-1">
          <label className="sr-only" htmlFor="sep-buscar">
            Buscar alumno
          </label>
          <Input
            ref={buscarRef}
            id="sep-buscar"
            type="search"
            autoComplete="off"
            value={q}
            placeholder="Buscar por nombre o no. de control…"
            className="pr-9"
            onChange={(e) => irA(() => setQ(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') irA(() => setQ(''));
            }}
          />
          {q ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:text-primary"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                irA(() => setQ(''));
                buscarRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end lg:ml-auto lg:w-auto lg:flex-nowrap">
          {seccion === 'tramites' ? (
            <>
              {/* 2026-10-12 - Excel/PDF de todas las filas filtradas (no solo la página), como en Solicitudes. */}
              {/* 2026-10-12 - shrink-0 para que Excel y PDF queden lado a lado y no se apilen al encogerse. */}
              <div className="shrink-0">
                <AdminExportListaButtons
                  flujo="solicitud"
                  titulo="Beca SEP"
                  filtroLabel={filtroTexto}
                  rows={[]}
                  destino={{
                    url: '/api/admin/sep/lista',
                    cuerpo: { ids: tramitesVisibles.map((t) => t.id), filtro: filtroTexto },
                    total: tramitesVisibles.length,
                    nombre: 'beca-sep',
                  }}
                />
              </div>
              <div className="w-full sm:w-40">
                <Select aria-label="Filtrar grado" value={grado ?? ''} onChange={(e) => irA(() => setGrado(e.target.value ? Number(e.target.value) : null))}>
                  <option value="">Todos los grados</option>
                  {gradosDisponibles.map((g) => (
                    <option key={g} value={g}>
                      {g}° grado
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-56">
                <Select aria-label="Ordenar" value={orden} onChange={(e) => irA(() => setOrden(e.target.value as OrdenTramite))}>
                  <option value="espera">Más tiempo esperando</option>
                  <option value="reciente">Más reciente</option>
                  <option value="nombre">Nombre A–Z</option>
                  <option value="control">No. de control</option>
                  <option value="porcentaje">Mayor porcentaje</option>
                </Select>
              </div>
              <div className="w-full sm:w-56">
                <Select aria-label="Filtrar estado" value={vista} onChange={(e) => irA(() => { setVista(e.target.value as VistaTramite); setSoloManual(false); })}>
                  {VISTAS_TRAMITE.map((v) => (
                    <option key={v.valor} value={v.valor}>
                      {v.texto}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : (
            <div className="w-full sm:w-56">
              <Select aria-label="Filtrar respuesta" value={filtroBx} onChange={(e) => irA(() => setFiltroBx(e.target.value as FiltroCuestionario))}>
                {FILTROS_BX.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.texto}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      {vacio ? (
        <Card className="text-sm text-text-secondary">{vacio}</Card>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            Mostrando {(paginaActual.pagina - 1) * POR_PAGINA_SEP + 1}–{Math.min(paginaActual.pagina * POR_PAGINA_SEP, paginaActual.total)} de {paginaActual.total}
            {seccion === 'tramites' && orden === 'espera' ? ' · primero quien lleva más tiempo esperando' : ''}
            {seccion === 'cuestionario' && resumen?.otra.nombres.length
              ? ` · Otras becas: ${resumen.otra.nombres.map((n) => `${n.nombre} (${n.total})`).join(', ')}`
              : ''}
          </p>
          {seccion === 'tramites' ? <ListaTramites filas={paginaTramites.items} /> : <ListaCuestionario filas={paginaBx.items} />}
        </>
      )}

      {paginaActual.paginas > 1 ? (
        <nav className="sep-pagina" aria-label="Páginas">
          <button type="button" disabled={paginaActual.pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </button>
          <span>
            Página {paginaActual.pagina} de {paginaActual.paginas}
          </span>
          <button type="button" disabled={paginaActual.pagina >= paginaActual.paginas} onClick={() => setPagina((p) => p + 1)}>
            Siguiente →
          </button>
        </nav>
      ) : null}
    </div>
  );
}

function Cifra({ num, texto, activa, aviso, onClick }: { num: number; texto: string; activa: boolean; aviso?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={activa} className={`sep-cifra${activa ? ' is-activa' : ''}${aviso ? ' is-aviso' : ''}`} onClick={onClick}>
      <span className="sep-cifra-txt">{texto}</span>
      <span className="sep-cifra-num">{num}</span>
    </button>
  );
}

const claseFila = (s: FilaTramiteSep) =>
  s.estado === 'aplicada' ? 'admin-table-row--activada' : s.revisionManual ? 'sep-row--aviso' : '';
const claseTarjeta = (s: FilaTramiteSep) =>
  s.estado === 'aplicada' ? 'admin-mobile-card--activada' : s.revisionManual ? 'sep-card--aviso' : '';

function ListaTramites({ filas }: { filas: FilaTramiteSep[] }) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {filas.map((s) => (
          <Link key={s.id} href={`/admin/sep/${s.id}`} className={`admin-mobile-card ${claseTarjeta(s)}`}>
            <p className="font-semibold text-primary">{s.nombreAlumno}</p>
            <p className="text-sm text-text-secondary">
              {s.alumnoRef} · {gradoTxt(s.grado, s.nivel)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoTramite s={s} layout="card" />
              {s.porcentaje != null ? <PorcentajeBadge pct={s.porcentaje} /> : null}
              <span className="text-sm font-semibold text-primary">{s.estado === 'enviada' ? 'Revisar →' : 'Ver →'}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-panel-card hidden overflow-x-auto md:block">
        <table className="admin-table">
          <thead>
            <tr>
              <th>No. control</th>
              <th>Alumno</th>
              <th>Grado</th>
              <th className="admin-table-col-estado">Estado</th>
              <th>Beca SEP</th>
              <th>Enviado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((s) => (
              <tr key={s.id} className={claseFila(s)}>
                <td>
                  <Link href={`/admin/sep/${s.id}`} className={`tabular-nums ${enlace}`}>
                    {s.alumnoRef}
                  </Link>
                </td>
                <td>{s.nombreAlumno}</td>
                <td>{gradoTxt(s.grado, s.nivel)}</td>
                <td className="admin-table-col-estado">
                  <EstadoTramite s={s} layout="table" />
                </td>
                <td>
                  <PorcentajeBadge pct={s.porcentaje} />
                </td>
                <td className="text-text-secondary">{fechaLarga(s.fecha)}</td>
                <td>
                  <Link href={`/admin/sep/${s.id}`} className={enlaceAccion}>
                    {s.estado === 'enviada' ? 'Revisar →' : 'Ver →'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PorcentajeBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-text-secondary">—</span>;
  return <span className="admin-badge-estado admin-badge-estado--mes-normal tabular-nums">{pct} %</span>;
}

function EstadoTramite({ s, layout }: { s: FilaTramiteSep; layout: 'table' | 'card' }) {
  let badge;
  if (s.estado === 'enviada') {
    badge = s.revisionManual ? (
      <span className="admin-badge-estado admin-badge-estado--espera-firma" title="El documento no se pudo leer solo; revíselo usted">
        Revisar a mano
      </span>
    ) : (
      <span className="admin-badge-estado admin-badge-estado--pendiente">Por revisar</span>
    );
  } else if (s.estado === 'aplicada') {
    badge = <span className="admin-badge-estado admin-badge-estado--activada">✓ Aplicada</span>;
  } else if (s.estado === 'correccion') {
    badge = (
      <span className="admin-badge-estado admin-badge-estado--correccion" title={s.motivoCorreccion ?? undefined}>
        Otro documento pedido
      </span>
    );
  } else {
    badge = <span className="admin-badge-estado admin-badge-estado--borrador">Sin enviar</span>;
  }

  return (
    <div className={`admin-lista-estado admin-lista-estado--${layout}`}>
      <div className="admin-lista-estado__badges">{badge}</div>
      {s.estado === 'aplicada' && s.monto != null ? (
        <p className="admin-lista-estado__firmante">
          <span className="admin-lista-estado__firmante-label">Mensualidad:</span>{' '}
          <span className="admin-lista-estado__firmante-nombre tabular-nums">{pesos(s.monto)}</span>
        </p>
      ) : null}
    </div>
  );
}

function ListaCuestionario({ filas }: { filas: FilaCuestionarioSep[] }) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {filas.map((f, i) => {
          const urgente = esUrgente(f);
          const contenido = (
            <>
              <p className="font-semibold text-primary">No. control {f.alumnoRef ?? '—'}</p>
              <p className="text-sm text-text-secondary">
                {nivelTxt(f.alumnoNivel)} · {becaTxt(f)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SituacionBx f={f} urgente={urgente} />
                {f.tramiteId ? <span className="text-sm font-semibold text-primary">Ver trámite →</span> : null}
              </div>
              {urgente && f.alumnoRef != null ? (
                <div className="mt-2">
                  <BotonRecordatorio alumnoRef={f.alumnoRef} ultimo={f.ultimoRecordatorio ?? null} />
                </div>
              ) : null}
            </>
          );
          const clase = `admin-mobile-card${urgente ? ' sep-card--aviso' : ''}`;
          return f.tramiteId ? (
            <Link key={`${f.alumnoRef}-${i}`} href={`/admin/sep/${f.tramiteId}`} className={clase}>
              {contenido}
            </Link>
          ) : (
            <div key={`${f.alumnoRef}-${i}`} className={clase}>
              {contenido}
            </div>
          );
        })}
      </div>

      <div className="admin-panel-card hidden overflow-x-auto md:block">
        <table className="admin-table">
          <thead>
            <tr>
              <th>No. control</th>
              <th>Nivel</th>
              <th>Beca</th>
              <th className="admin-table-col-estado">Situación</th>
              <th>Respondió</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const urgente = esUrgente(f);
              return (
                <tr key={`${f.alumnoRef}-${i}`} className={urgente ? 'sep-row--aviso' : f.tieneTramite ? 'admin-table-row--activada' : undefined}>
                  <td className="tabular-nums font-semibold text-primary">{f.alumnoRef ?? '—'}</td>
                  <td>{nivelTxt(f.alumnoNivel)}</td>
                  <td>{becaTxt(f)}</td>
                  <td className="admin-table-col-estado">
                    <SituacionBx f={f} urgente={urgente} />
                  </td>
                  <td className="text-text-secondary">{fechaLarga(f.actualizadoEn)}</td>
                  <td>
                    {f.tramiteId ? (
                      <Link href={`/admin/sep/${f.tramiteId}`} className={enlaceAccion}>
                        Ver trámite →
                      </Link>
                    ) : urgente && f.alumnoRef != null ? (
                      <BotonRecordatorio alumnoRef={f.alumnoRef} ultimo={f.ultimoRecordatorio ?? null} />
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * 2026-10-12 - "Enviar recordatorio" a la familia que dijo tener Beca SEP pero no ha subido su documento.
 * Uno cada 7 días por alumno: `ultimo` solo llega si fue en esos 7 días (el servidor lo valida con la bitácora).
 */
function BotonRecordatorio({ alumnoRef, ultimo }: { alumnoRef: number; ultimo: string | null }) {
  const [enviadoEn, setEnviadoEn] = useState<string | null>(ultimo);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function enviar() {
    if (!window.confirm(`¿Enviar a la familia del No. de control ${alumnoRef} el recordatorio para subir su documento de Beca SEP?`)) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sep/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoRef }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; enviadoEn?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el recordatorio.');
      setEnviadoEn(data.enviadoEn ?? new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el recordatorio.');
    } finally {
      setCargando(false);
    }
  }

  if (enviadoEn) {
    return (
      <span className="sep-recordado" title="Se puede volver a enviar 7 días después">
        ✓ Recordatorio enviado {new Date(enviadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
      </span>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="sep-btn-recordar" onClick={enviar} disabled={cargando}>
        {cargando ? 'Enviando…' : 'Enviar recordatorio'}
      </button>
      {error ? <span className="text-xs text-red-700 dark:text-red-300">{error}</span> : null}
    </div>
  );
}

const esUrgente = (f: FilaCuestionarioSep) => f.beneficio === 'sep' && f.recibio === true && !f.tieneTramite && !f.esPrueba;

function becaTxt(f: FilaCuestionarioSep) {
  if (!f.aplico) return 'Ninguna';
  if (f.beneficio === 'sep') return 'Beca SEP';
  return f.beneficioNombre?.trim() || 'Otra beca';
}

function SituacionBx({ f, urgente }: { f: FilaCuestionarioSep; urgente: boolean }) {
  const b = (variante: string, texto: string) => <span className={`admin-badge-estado admin-badge-estado--${variante}`}>{texto}</span>;
  if (f.esPrueba) return <span className="admin-badge-estado sep-badge--prueba">Prueba</span>;
  if (urgente) return b('correccion', 'Ya la recibió · falta documento');
  if (!f.aplico) return b('borrador', 'No aplicó');
  if (f.tieneTramite) return b('verificada', 'Ya hay trámite');
  if (f.recibio) return b('espera-firma', 'Ya la recibió');
  return b('mes-normal', 'En espera');
}
