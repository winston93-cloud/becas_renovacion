'use client';

/**
 * 2026-10-07 - Beca SEP: acciones de Control Escolar (porcentaje, Aplicar, Pedir corrección)
 * y de Sistemas (recalcular, ajuste manual con motivo).
 * 2026-10-09 - Sistemas ahora se llama Dirección General; se agrega el aviso de pagos a la familia.
 */
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Undo2, Wrench } from 'lucide-react';
import { Alert, Button, Input, Label, Textarea } from '@/components/ui';

async function postAccion(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/sep/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'No se pudo completar la acción.');
}

/** Lo que ve la coordinación: el resultado del cálculo en una frase, sin la hoja completa. */
export type ResumenRevision = {
  aplicaSep: boolean;
  mensual: number | null;
  meses: string[];
  saldoFavor: number;
  conclusion: string;
};

export type RenglonRevision = { ok: boolean; texto: string; detalle: string };

/** 2026-10-08 - Motivos frecuentes para regresar el documento (un clic). */
const MOTIVOS = [
  'El documento es de otro alumno. Suba la autorización de la SEP a nombre de su hijo(a).',
  'No se puede leer el documento. Súbalo otra vez, completo y más claro (PDF o foto nítida).',
  'El archivo no es la autorización de beca de la SEP. Suba el documento oficial que le entregó la SEP.',
  'En el documento no aparece el porcentaje de beca. Suba la hoja donde viene el porcentaje autorizado.',
];

/**
 * 2026-10-08 - Porcentajes que se eligen con un clic (en la lista SEP 2025-26, 100 de 115 fueron 20 % y el
 * resto 25-50 %). Cualquier otro valor se escribe a mano y se confirma escribiéndolo dos veces.
 */
const PORCENTAJES_COMUNES = [20, 25, 30, 35, 40, 45, 50];

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/**
 * 2026-10-08 - Revisión simplificada para Control Escolar: lista de sí/no, porcentaje que recalcula solo,
 * el monto mensual en grande, Aplicar o Regresar a la familia (con motivos de un clic), y al terminar
 * pasa al siguiente pendiente.
 */
export function AccionesControlEscolar({
  id,
  nombre,
  renglones,
  porcentajeDetectado,
  porcentajeVista,
  resumen,
  errorCalculo,
  bloqueos,
  siguienteId,
}: {
  id: string;
  nombre: string;
  renglones: RenglonRevision[];
  porcentajeDetectado: number | null;
  /** Porcentaje con el que el servidor calculó `resumen`. */
  porcentajeVista: number | null;
  resumen: ResumenRevision | null;
  errorCalculo: string | null;
  /** Avisos que impiden aplicar (faltan precios, plan, etc.). */
  bloqueos: string[];
  siguienteId: string | null;
}) {
  const router = useRouter();
  const [pct, setPct] = useState(porcentajeVista != null ? String(porcentajeVista) : '');
  // 2026-10-08 - Selector de porcentaje: "manual" solo para valores fuera de los comunes, con confirmación.
  const [manual, setManual] = useState(porcentajeVista != null && !PORCENTAJES_COMUNES.includes(porcentajeVista));
  const [confirmacion, setConfirmacion] = useState('');
  const [modo, setModo] = useState<'revisar' | 'regresar'>('revisar');
  const [motivo, setMotivo] = useState<string | null>(null);
  const [otro, setOtro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recalculando, startRecalculo] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pctNum = Number(pct);
  const pctValido = pct !== '' && Number.isInteger(pctNum) && pctNum > 0 && pctNum <= 100;
  // Lo que leyó el sistema del documento no necesita confirmarse; lo escrito a mano sí.
  const manualConfirmado = !manual || pctNum === porcentajeDetectado || confirmacion === pct;
  const calculando = recalculando || (pctValido && pctNum !== porcentajeVista);
  const puedeAplicar =
    pctValido && manualConfirmado && !calculando && !!resumen && !errorCalculo && bloqueos.length === 0;
  const textoMotivo = motivo === 'otro' ? otro.trim() : motivo;

  function recalcular(n: number, espera: number) {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      startRecalculo(() => router.replace(`/admin/sep/${id}?pct=${n}`, { scroll: false }));
    }, espera);
  }

  function elegirComun(n: number) {
    setManual(false);
    setConfirmacion('');
    setPct(String(n));
    if (n !== porcentajeVista) recalcular(n, 0);
  }

  function elegirManual() {
    setManual(true);
    setConfirmacion('');
    setPct('');
    if (temporizador.current) clearTimeout(temporizador.current);
  }

  function cambiarManual(valor: string) {
    const limpio = valor.replace(/\D/g, '').slice(0, 3);
    setPct(limpio);
    setConfirmacion('');
    const n = Number(limpio);
    if (limpio === '' || n <= 0 || n > 100) {
      if (temporizador.current) clearTimeout(temporizador.current);
      return;
    }
    recalcular(n, 500);
  }

  async function ejecutar(body: Record<string, unknown>, confirmar: string, hecho: 'aplicada' | 'correccion') {
    if (!window.confirm(confirmar)) return;
    setError(null);
    setOcupado(true);
    try {
      await postAccion(id, body);
      const aviso = `hecho=${hecho}&de=${encodeURIComponent(nombre)}`;
      router.push(siguienteId ? `/admin/sep/${siguienteId}?${aviso}` : `/admin/sep?${aviso}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-3">
        {renglones.map((r) => (
          <li key={r.texto} className="flex gap-3">
            {r.ok ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="Correcto" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-label="Revisar" />
            )}
            <div>
              <p className="font-semibold">{r.texto}</p>
              <p className={`text-sm ${r.ok ? 'text-text-secondary' : 'text-warning'}`}>{r.detalle}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* 2026-10-08 - Selector de un clic en lugar de escribir el porcentaje (evita errores de dedo). */}
      <fieldset disabled={modo === 'regresar'}>
        <legend className="text-sm font-semibold">
          Porcentaje de beca que dice el documento <span className="text-error">*</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Porcentaje de beca">
          {PORCENTAJES_COMUNES.map((n) => {
            const activo = !manual && pct === String(n);
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => elegirComun(n)}
                className={`relative min-w-[4.5rem] rounded-xl border px-3 py-2 text-lg font-semibold transition-colors disabled:opacity-50 ${
                  activo ? 'border-primary bg-primary text-white' : 'border-border bg-card hover:bg-primary-light'
                }`}
              >
                {n} %
                {n === porcentajeDetectado ? (
                  <span className="absolute -right-2 -top-2 rounded-full bg-success px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                    leído
                  </span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={manual}
            onClick={elegirManual}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
              manual ? 'border-primary bg-primary text-white' : 'border-dashed border-border bg-card hover:bg-primary-light'
            }`}
          >
            Otro porcentaje
          </button>
        </div>

        {manual ? (
          <div className="mt-3 grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="sep_pct">Escriba el porcentaje</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="sep_pct"
                  inputMode="numeric"
                  className="max-w-[6rem] text-lg font-semibold"
                  value={pct}
                  onChange={(e) => cambiarManual(e.target.value)}
                  autoFocus={pct === ''}
                />
                <span className="text-lg font-semibold">%</span>
              </div>
            </div>
            {pctValido && pctNum !== porcentajeDetectado ? (
              <div>
                <Label htmlFor="sep_pct_confirma">Escríbalo otra vez para confirmar</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="sep_pct_confirma"
                    inputMode="numeric"
                    className="max-w-[6rem] text-lg font-semibold"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    onPaste={(e) => e.preventDefault()}
                    autoComplete="off"
                  />
                  <span className="text-lg font-semibold">%</span>
                  {confirmacion.length >= pct.length ? (
                    manualConfirmado ? (
                      <CheckCircle2 className="h-5 w-5 text-success" aria-label="Coincide" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-warning" aria-label="No coincide" />
                    )
                  ) : null}
                </div>
                {confirmacion.length >= pct.length && !manualConfirmado ? (
                  <p className="mt-1 text-xs text-warning">No coincide con el primero. Revise el documento.</p>
                ) : null}
              </div>
            ) : null}
            {pct !== '' && !pctValido ? (
              <p className="text-xs text-error sm:col-span-2">Escriba un número entero del 1 al 100.</p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-2 text-xs text-text-secondary">
          {porcentajeDetectado != null
            ? `El sistema leyó ${porcentajeDetectado} % del documento. Si dice otro, elíjalo.`
            : 'El sistema no pudo leerlo: elija el que viene en el documento.'}
        </p>
      </fieldset>

      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4" aria-live="polite">
        {!pctValido ? (
          <p className="text-sm text-text-secondary">Elija el porcentaje para ver cuánto pagará la familia.</p>
        ) : calculando ? (
          <p className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Calculando con {pct} %…
          </p>
        ) : errorCalculo ? (
          <p className="text-sm text-error">{errorCalculo}</p>
        ) : !resumen ? (
          <p className="text-sm text-warning">No se pudo calcular: faltan datos del alumno. Avise a Sistemas.</p>
        ) : !resumen.aplicaSep ? (
          <>
            <p className="text-sm font-semibold">La beca SEP no cambia lo que paga.</p>
            <p className="text-sm text-text-secondary">{resumen.conclusion}</p>
          </>
        ) : resumen.mensual === 0 ? (
          <>
            <p className="text-xl font-bold text-primary">Ya no paga colegiatura este ciclo</p>
            <p className="text-sm text-text-secondary">
              Con lo que ya pagó se cubren los meses que faltan.
              {resumen.saldoFavor > 0 ? ` Además le sobran ${dinero(resumen.saldoFavor)} a su favor.` : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">Con la beca, la familia pagará</p>
            <p className="text-2xl font-bold text-primary">{dinero(resumen.mensual ?? 0)} al mes</p>
            {resumen.meses.length ? (
              <p className="text-sm text-text-secondary">
                {resumen.meses.length === 1
                  ? `en ${resumen.meses[0]}`
                  : `de ${resumen.meses[0]} a ${resumen.meses[resumen.meses.length - 1]} (${resumen.meses.length} meses)`}
              </p>
            ) : null}
          </>
        )}
      </div>

      {bloqueos.length ? (
        <Alert variant="warning" title="Todavía no se puede aplicar">
          <ul className="list-disc pl-4">
            {bloqueos.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-1">Avise a Sistemas para que lo revise.</p>
        </Alert>
      ) : null}

      {modo === 'revisar' ? (
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!puedeAplicar || ocupado}
            onClick={() =>
              ejecutar(
                { accion: 'aplicar', porcentaje: pctNum },
                `¿Aplicar la beca SEP del ${pct} % a ${nombre}?`,
                'aplicada'
              )
            }
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {ocupado ? 'Aplicando…' : 'Aplicar beca'}
          </Button>
          <Button variant="secondary" disabled={ocupado} onClick={() => setModo('regresar')}>
            <Undo2 className="h-4 w-4" aria-hidden />
            Regresar a la familia
          </Button>
          {pctValido && !manualConfirmado ? (
            <p className="w-full text-xs text-text-secondary">Confirme el porcentaje escrito a mano para poder aplicar.</p>
          ) : null}
        </div>
      ) : (
        <fieldset className="space-y-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold">¿Por qué se regresa? (la familia verá este mensaje)</legend>
          <div className="space-y-2">
            {MOTIVOS.map((m) => (
              <label key={m} className="flex cursor-pointer gap-2 text-sm">
                <input type="radio" name="sep_motivo" checked={motivo === m} onChange={() => setMotivo(m)} className="mt-1" />
                <span>{m}</span>
              </label>
            ))}
            <label className="flex cursor-pointer gap-2 text-sm">
              <input type="radio" name="sep_motivo" checked={motivo === 'otro'} onChange={() => setMotivo('otro')} className="mt-1" />
              <span>Otro motivo</span>
            </label>
            {motivo === 'otro' ? (
              <Textarea
                rows={2}
                value={otro}
                onChange={(e) => setOtro(e.target.value)}
                placeholder="Escriba el motivo para la familia"
                aria-label="Otro motivo"
                autoFocus
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!textoMotivo || textoMotivo.length < 5 || ocupado}
              onClick={() =>
                ejecutar({ accion: 'correccion', motivo: textoMotivo }, `¿Regresar el documento a la familia de ${nombre}?`, 'correccion')
              }
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              {ocupado ? 'Enviando…' : 'Regresar a la familia'}
            </Button>
            <Button variant="ghost" disabled={ocupado} onClick={() => setModo('revisar')}>
              Cancelar
            </Button>
          </div>
        </fieldset>
      )}

      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}

export function AccionesSistemas({ id, tieneAjuste }: { id: string; tieneAjuste: boolean }) {
  const router = useRouter();
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(body: Record<string, unknown>, confirmar: string) {
    if (!window.confirm(confirmar)) return;
    setError(null);
    setOcupado(true);
    try {
      await postAccion(id, body);
      setMonto('');
      setMotivo('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        variant="secondary"
        disabled={ocupado}
        onClick={() => ejecutar({ accion: 'recalcular' }, '¿Recalcular con los pagos actuales de InsForge?')}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Recalcular con pagos actuales
      </Button>
      <div className="space-y-2">
        <Label htmlFor="sep_ajuste">Ajuste manual de la mensualidad</Label>
        <div className="flex max-w-xs items-center gap-2">
          <span className="text-sm text-text-secondary">$</span>
          <Input
            id="sep_ajuste"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder={tieneAjuste ? 'Vacío = quitar ajuste' : 'Monto mensual'}
          />
        </div>
        <Textarea
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo del ajuste (obligatorio, mínimo 10 caracteres)"
          aria-label="Motivo del ajuste"
        />
        <Button
          variant="secondary"
          disabled={motivo.trim().length < 10 || (!monto && !tieneAjuste) || ocupado}
          onClick={() =>
            ejecutar(
              { accion: 'ajuste', monto, motivo },
              monto ? `¿Ajustar la mensualidad a $${monto}?` : '¿Quitar el ajuste manual?'
            )
          }
        >
          <Wrench className="h-4 w-4" aria-hidden />
          {monto ? 'Guardar ajuste' : 'Quitar ajuste'}
        </Button>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}

/** 2026-10-09 - Correo a la familia con las diferencias de pago (de menos / de más) contra la mensualidad SEP. */
export function BotonAvisarPago({ id, avisos }: { id: string; avisos: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function avisar() {
    const ya = avisos ? ` Ya se le ha avisado ${avisos === 1 ? '1 vez' : `${avisos} veces`}.` : '';
    if (!window.confirm(`¿Enviar a la familia el correo con las diferencias de pago?${ya}`)) return;
    setError(null);
    setOcupado(true);
    try {
      await postAccion(id, { accion: 'avisar_pago' });
      setListo(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" disabled={ocupado} onClick={avisar}>
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        Avisar a la familia por correo
      </Button>
      {listo ? <p className="text-xs text-success">Correo enviado; quedó en el historial del trámite.</p> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
