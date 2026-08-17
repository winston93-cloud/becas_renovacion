'use client';

/**
 * 2026-07-17 - Formulario multipestaña de solicitud de beca (réplica de Index2.php).
 * Usa catálogo becas_concepto_beca para tipo de beca deseada.
 * 2026-07-18 - Sin SEP (beca de gobierno; no se tramita aquí).
 */
import { useMemo, useState } from 'react';
import type { Hermano, SolicitudPayload, SolicitudPrecarga } from '@/lib/types';
import { fetchConAcceso } from '@/lib/acceso-session';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrado } from '@/lib/label-grado';
import { labelGrupo } from '@/lib/label-grupo';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui';

type Props = {
  data: SolicitudPrecarga;
  onSaved: (solicitudId: string, becaDeseadaId: number) => void;
};

const emptyHermanos = (): Hermano[] =>
  [1, 2, 3, 4].map((orden) => ({
    orden,
    nombre: '',
    edad: null,
    institucion: '',
    colegiatura_mensual: null,
  }));

export default function TabsFormularioSolicitud({ data, onSaved }: Props) {
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHermanos, setShowHermanos] = useState(data.hermanos.length > 0);

  const [becaDeseadaId, setBecaDeseadaId] = useState(
    data.solicitud?.beca_deseada_id?.toString() || ''
  );
  const [becaPct, setBecaPct] = useState(
    data.solicitud?.beca_porcentaje_deseado?.toString() || ''
  );
  const [tieneOtraBeca, setTieneOtraBeca] = useState(
    Boolean(data.solicitud?.tiene_otra_beca)
  );
  // 2026-07-18 - SEP ya no se ofrece como “otra beca”
  const [otraPemex, setOtraPemex] = useState(
    Boolean(data.solicitud?.otra_beca_pemex)
  );
  const [otraEmp, setOtraEmp] = useState(
    Boolean(data.solicitud?.otra_beca_empresarial)
  );
  const [otraOtro, setOtraOtro] = useState(
    Boolean(data.solicitud?.otra_beca_otro)
  );

  const [calle, setCalle] = useState(data.detalle?.alumno_calle || '');
  const [numero, setNumero] = useState(data.detalle?.alumno_numero || '');
  const [colonia, setColonia] = useState(data.detalle?.alumno_colonia || '');
  const [cp, setCp] = useState(data.detalle?.alumno_cp || '');

  const [mamaNombre, setMamaNombre] = useState(
    `${data.mama?.familiar_app || ''} ${data.mama?.familiar_apm || ''} ${data.mama?.familiar_nombre || ''}`.trim()
  );
  const [mamaVive, setMamaVive] = useState(Boolean(data.mama?.familiar_vive));
  const [mamaEmpresa, setMamaEmpresa] = useState(
    data.mama?.familiar_empresa_nombre || ''
  );
  const [mamaPuesto, setMamaPuesto] = useState(
    data.mama?.familiar_empresa_puesto || ''
  );
  // 2026-07-17 - Ocupación + tel. oficina (gaps docs/10)
  const [mamaOcupacion, setMamaOcupacion] = useState(
    data.mama?.familiar_escolaridad || ''
  );
  const [mamaTelOficina, setMamaTelOficina] = useState(
    data.mama?.familiar_empresa_tel || ''
  );
  const [mamaTel, setMamaTel] = useState(data.mama?.familiar_tel || '');
  const [mamaCel, setMamaCel] = useState(data.mama?.familiar_cel || '');
  const [mamaEmail, setMamaEmail] = useState(data.mama?.familiar_email || '');
  const [ingresoMadre, setIngresoMadre] = useState('');

  const [papaNombre, setPapaNombre] = useState(
    `${data.papa?.familiar_app || ''} ${data.papa?.familiar_apm || ''} ${data.papa?.familiar_nombre || ''}`.trim()
  );
  const [papaVive, setPapaVive] = useState(Boolean(data.papa?.familiar_vive));
  const [papaEmpresa, setPapaEmpresa] = useState(
    data.papa?.familiar_empresa_nombre || ''
  );
  const [papaPuesto, setPapaPuesto] = useState(
    data.papa?.familiar_empresa_puesto || ''
  );
  const [papaOcupacion, setPapaOcupacion] = useState(
    data.papa?.familiar_escolaridad || ''
  );
  const [papaTelOficina, setPapaTelOficina] = useState(
    data.papa?.familiar_empresa_tel || ''
  );
  const [papaTel, setPapaTel] = useState(data.papa?.familiar_tel || '');
  const [papaCel, setPapaCel] = useState(data.papa?.familiar_cel || '');
  const [papaEmail, setPapaEmail] = useState(data.papa?.familiar_email || '');
  const [ingresoPadre, setIngresoPadre] = useState('');

  const [aportaGastos, setAportaGastos] = useState<boolean | null>(
    data.solicitud?.aporta_gastos ?? null
  );
  const [parentesco, setParentesco] = useState(
    data.solicitud?.parentesco_aportante || ''
  );
  const [viviendaTipo, setViviendaTipo] = useState(
    data.solicitud?.vivienda_tipo || 'propia'
  );
  const [motivo, setMotivo] = useState(data.solicitud?.motivo || '');

  const initialHermanos = useMemo(() => {
    const base = emptyHermanos();
    for (const h of data.hermanos) {
      const idx = h.orden - 1;
      if (idx >= 0 && idx < 4) base[idx] = { ...h };
    }
    return base;
  }, [data.hermanos]);

  const [hermanos, setHermanos] = useState<Hermano[]>(initialHermanos);

  const tabs = [
    { label: 'Beca', short: 'Beca' },
    { label: 'Alumno', short: 'Alumno' },
    { label: 'Padre', short: 'Padre' },
    { label: 'Madre', short: 'Madre' },
    { label: 'Adicional', short: 'Más' },
  ];

  function updateHermano(orden: number, patch: Partial<Hermano>) {
    setHermanos((prev) =>
      prev.map((h) => (h.orden === orden ? { ...h, ...patch } : h))
    );
  }

  function splitNombre(full: string) {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { app: '', apm: '', nombre: '' };
    if (parts.length === 1) return { app: parts[0], apm: '', nombre: '' };
    if (parts.length === 2) return { app: parts[0], apm: '', nombre: parts[1] };
    return { app: parts[0], apm: parts[1], nombre: parts.slice(2).join(' ') };
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      if (!becaDeseadaId) {
        throw new Error('Seleccione el tipo de beca deseada.');
      }
      const mamaParts = splitNombre(mamaNombre);
      const papaParts = splitNombre(papaNombre);

      const payload: SolicitudPayload = {
        alumno_id: data.alumno.id,
        beca_deseada_id: Number(becaDeseadaId),
        beca_porcentaje_deseado: becaPct ? Number(becaPct) : null,
        tiene_otra_beca: tieneOtraBeca,
        otra_beca_sep: false,
        otra_beca_pemex: otraPemex,
        otra_beca_empresarial: otraEmp,
        otra_beca_otro: otraOtro,
        aporta_gastos: aportaGastos,
        parentesco_aportante: parentesco,
        vivienda_tipo: viviendaTipo,
        motivo,
        ingreso_mensual_padre: ingresoPadre ? Number(ingresoPadre) : null,
        ingreso_mensual_madre: ingresoMadre ? Number(ingresoMadre) : null,
        detalle: {
          alumno_calle: calle,
          alumno_numero: numero,
          alumno_colonia: colonia,
          alumno_cp: cp,
        },
        mama: {
          tutor_id: 1,
          familiar_app: mamaParts.app,
          familiar_apm: mamaParts.apm,
          familiar_nombre: mamaParts.nombre,
          familiar_vive: mamaVive,
          familiar_escolaridad: mamaOcupacion || null,
          familiar_empresa_nombre: mamaEmpresa,
          familiar_empresa_puesto: mamaPuesto,
          familiar_empresa_tel: mamaTelOficina || null,
          familiar_tel: mamaTel,
          familiar_cel: mamaCel,
          familiar_email: mamaEmail,
        },
        papa: {
          tutor_id: 2,
          familiar_app: papaParts.app,
          familiar_apm: papaParts.apm,
          familiar_nombre: papaParts.nombre,
          familiar_vive: papaVive,
          familiar_escolaridad: papaOcupacion || null,
          familiar_empresa_nombre: papaEmpresa,
          familiar_empresa_puesto: papaPuesto,
          familiar_empresa_tel: papaTelOficina || null,
          familiar_tel: papaTel,
          familiar_cel: papaCel,
          familiar_email: papaEmail,
        },
        hermanos: showHermanos ? hermanos : [],
      };

      const res = await fetchConAcceso('/api/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar la solicitud.');
      onSaved(json.solicitud_id, Number(becaDeseadaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding={false}>
      <div
        role="tablist"
        aria-label="Secciones del formulario de solicitud"
        // 2026-07-18 - Scroll suave + fade en móvil
        className="relative flex gap-1 overflow-x-auto scroll-smooth border-b border-border px-3 pt-3 [mask-image:linear-gradient(90deg,#000_85%,transparent)] sm:px-4 sm:[mask-image:none]"
      >
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={tab === i}
            onClick={() => setTab(i)}
            className={[
              // 2026-07-22 - Más contraste en pestaña activa
              'shrink-0 rounded-t-[10px] border-b-2 px-2.5 py-2 text-xs font-medium transition duration-[180ms] sm:px-3 sm:py-2.5 sm:text-sm',
              'focus-visible:outline-none focus-visible:shadow-focus',
              tab === i
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-transparent text-text-secondary hover:bg-bg hover:text-text',
            ].join(' ')}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 2026-07-18 - Fade corto al cambiar de pestaña */}
      <div
        key={tab}
        className="ui-enter space-y-5 p-5 sm:p-6"
        role="tabpanel"
      >
        {tab === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Alumno</Label>
              <Input value={data.alumno.nombre_completo} readOnly />
            </div>
            <div>
              <Label>No. Control</Label>
              <Input value={data.alumno.alumno_ref} readOnly />
            </div>
            <div>
              <Label>Ciclo escolar</Label>
              <Input
                value={`Solicitud de becas ciclo ${data.ciclo_label}`}
                readOnly
              />
            </div>
            <div>
              <Label>Nivel</Label>
              <Input
                value={labelNivel(data.alumno.alumno_nivel)}
                readOnly
              />
            </div>
            <div>
              <Label>Grado / Grupo</Label>
              <Input
                value={`${labelGrado(data.alumno.alumno_nivel, data.alumno.alumno_grado)} / ${labelGrupo(data.alumno.alumno_grupo)}`}
                readOnly
              />
            </div>
            <div>
              <Label htmlFor="becaDeseada" required>
                Tipo de beca deseada
              </Label>
              <Select
                id="becaDeseada"
                value={becaDeseadaId}
                onChange={(e) => setBecaDeseadaId(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {data.conceptos.map((c) => (
                  <option key={c.beca_id} value={c.beca_id}>
                    {c.beca_clase}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="becaPct">Porcentaje solicitado (%)</Label>
              <Input
                id="becaPct"
                type="number"
                min={0}
                max={100}
                value={becaPct}
                onChange={(e) => setBecaPct(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 space-y-3">
              <Checkbox
                id="tieneOtra"
                checked={tieneOtraBeca}
                onChange={(e) => setTieneOtraBeca(e.target.checked)}
                label="¿Cuenta actualmente con otra beca?"
              />
              {tieneOtraBeca && (
                <div className="flex flex-wrap gap-4 rounded-[12px] border border-border bg-bg p-4">
                  <Checkbox
                    id="otraPemex"
                    checked={otraPemex}
                    onChange={(e) => setOtraPemex(e.target.checked)}
                    label="PEMEX"
                  />
                  <Checkbox
                    id="otraEmp"
                    checked={otraEmp}
                    onChange={(e) => setOtraEmp(e.target.checked)}
                    label="Empresarial"
                  />
                  <Checkbox
                    id="otraOtro"
                    checked={otraOtro}
                    onChange={(e) => setOtraOtro(e.target.checked)}
                    label="Otra"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="calle">Calle</Label>
              <Input
                id="calle"
                value={calle}
                onChange={(e) => setCalle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cp">C.P.</Label>
              <Input
                id="cp"
                value={cp}
                onChange={(e) => setCp(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="colonia">Colonia</Label>
              <Input
                id="colonia"
                value={colonia}
                onChange={(e) => setColonia(e.target.value)}
              />
            </div>
            <div>
              <Label>Municipio</Label>
              <Input value="MADERO" readOnly />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value="TAMAULIPAS" readOnly />
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="papaNombre">Nombre del padre</Label>
              <Input
                id="papaNombre"
                value={papaNombre}
                onChange={(e) => setPapaNombre(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="papaVive">¿Vive?</Label>
              <Select
                id="papaVive"
                value={papaVive ? '1' : '0'}
                onChange={(e) => setPapaVive(e.target.value === '1')}
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ingresoPadre">Ingreso neto mensual</Label>
              <Input
                id="ingresoPadre"
                type="number"
                min={0}
                value={ingresoPadre}
                onChange={(e) => setIngresoPadre(e.target.value)}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                Por políticas de privacidad, el salario no se almacena; solo se
                usa para el expediente de coordinación.
              </p>
            </div>
            <div>
              <Label htmlFor="papaOcupacion">Ocupación</Label>
              <Input
                id="papaOcupacion"
                value={papaOcupacion}
                onChange={(e) => setPapaOcupacion(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="papaEmpresa">Empresa</Label>
              <Input
                id="papaEmpresa"
                value={papaEmpresa}
                onChange={(e) => setPapaEmpresa(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="papaPuesto">Puesto</Label>
              <Input
                id="papaPuesto"
                value={papaPuesto}
                onChange={(e) => setPapaPuesto(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="papaTel">Teléfono casa</Label>
              <Input
                id="papaTel"
                value={papaTel}
                onChange={(e) => setPapaTel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="papaTelOficina">Teléfono oficina</Label>
              <Input
                id="papaTelOficina"
                value={papaTelOficina}
                onChange={(e) => setPapaTelOficina(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="papaCel">Celular</Label>
              <Input
                id="papaCel"
                value={papaCel}
                onChange={(e) => setPapaCel(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="papaEmail">Correo</Label>
              <Input
                id="papaEmail"
                type="email"
                value={papaEmail}
                onChange={(e) => setPapaEmail(e.target.value)}
              />
            </div>
          </div>
        )}

        {tab === 3 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="mamaNombre">Nombre de la madre</Label>
              <Input
                id="mamaNombre"
                value={mamaNombre}
                onChange={(e) => setMamaNombre(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mamaVive">¿Vive?</Label>
              <Select
                id="mamaVive"
                value={mamaVive ? '1' : '0'}
                onChange={(e) => setMamaVive(e.target.value === '1')}
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ingresoMadre">Ingreso neto mensual</Label>
              <Input
                id="ingresoMadre"
                type="number"
                min={0}
                value={ingresoMadre}
                onChange={(e) => setIngresoMadre(e.target.value)}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                Por políticas de privacidad, el salario no se almacena; solo se
                usa para el expediente de coordinación.
              </p>
            </div>
            <div>
              <Label htmlFor="mamaOcupacion">Ocupación</Label>
              <Input
                id="mamaOcupacion"
                value={mamaOcupacion}
                onChange={(e) => setMamaOcupacion(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mamaEmpresa">Empresa</Label>
              <Input
                id="mamaEmpresa"
                value={mamaEmpresa}
                onChange={(e) => setMamaEmpresa(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mamaPuesto">Puesto</Label>
              <Input
                id="mamaPuesto"
                value={mamaPuesto}
                onChange={(e) => setMamaPuesto(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mamaTel">Teléfono casa</Label>
              <Input
                id="mamaTel"
                value={mamaTel}
                onChange={(e) => setMamaTel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mamaTelOficina">Teléfono oficina</Label>
              <Input
                id="mamaTelOficina"
                value={mamaTelOficina}
                onChange={(e) => setMamaTelOficina(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mamaCel">Celular</Label>
              <Input
                id="mamaCel"
                value={mamaCel}
                onChange={(e) => setMamaCel(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="mamaEmail">Correo</Label>
              <Input
                id="mamaEmail"
                type="email"
                value={mamaEmail}
                onChange={(e) => setMamaEmail(e.target.value)}
              />
            </div>
          </div>
        )}

        {tab === 4 && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="aporta">¿Alguien más aporta gastos?</Label>
                <Select
                  id="aporta"
                  value={
                    aportaGastos === null ? '' : aportaGastos ? '1' : '0'
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setAportaGastos(v === '' ? null : v === '1');
                  }}
                >
                  <option value="">Seleccione...</option>
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </Select>
              </div>
              {aportaGastos && (
                <div>
                  <Label htmlFor="parentesco">Parentesco del aportante</Label>
                  <Input
                    id="parentesco"
                    value={parentesco}
                    onChange={(e) => setParentesco(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="vivienda">Tipo de vivienda</Label>
                <Select
                  id="vivienda"
                  value={viviendaTipo}
                  onChange={(e) => setViviendaTipo(e.target.value)}
                >
                  <option value="propia">Propia</option>
                  <option value="rentada">Rentada</option>
                  <option value="otro">Otro</option>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="motivo" required>
                Motivo de la solicitud
              </Label>
              <Textarea
                id="motivo"
                rows={4}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-text-secondary">
                {motivo.length}/500 caracteres
              </p>
            </div>

            <div>
              <Checkbox
                id="showHermanos"
                checked={showHermanos}
                onChange={(e) => setShowHermanos(e.target.checked)}
                label="Registrar hermanos (hasta 4)"
              />
            </div>

            {showHermanos && (
              <div className="space-y-4">
                {hermanos.map((h) => (
                  <div
                    key={h.orden}
                    className="grid gap-3 rounded-[12px] border border-border p-4 md:grid-cols-4"
                  >
                    <div className="md:col-span-2">
                      <Label htmlFor={`hn-${h.orden}`}>Nombre</Label>
                      <Input
                        id={`hn-${h.orden}`}
                        value={h.nombre}
                        onChange={(e) =>
                          updateHermano(h.orden, { nombre: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`he-${h.orden}`}>Edad</Label>
                      <Input
                        id={`he-${h.orden}`}
                        type="number"
                        min={0}
                        value={h.edad ?? ''}
                        onChange={(e) =>
                          updateHermano(h.orden, {
                            edad: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`hc-${h.orden}`}>Colegiatura</Label>
                      <Input
                        id={`hc-${h.orden}`}
                        type="number"
                        min={0}
                        value={h.colegiatura_mensual ?? ''}
                        onChange={(e) =>
                          updateHermano(h.orden, {
                            colegiatura_mensual: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label htmlFor={`hi-${h.orden}`}>Institución</Label>
                      <Input
                        id={`hi-${h.orden}`}
                        value={h.institucion}
                        onChange={(e) =>
                          updateHermano(h.orden, {
                            institucion: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <Alert variant="error" className="mt-2">
            {error}
          </Alert>
        )}

        {/* 2026-07-18 - Sticky + safe-area; paridad con renovación */}
        <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-border bg-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
          <Button
            type="button"
            variant="secondary"
            disabled={tab === 0 || saving}
            onClick={() => setTab((t) => Math.max(0, t - 1))}
            className="w-full sm:w-auto"
          >
            Anterior
          </Button>
          {tab < tabs.length - 1 ? (
            <Button
              type="button"
              onClick={() => setTab((t) => Math.min(tabs.length - 1, t + 1))}
              className="w-full sm:w-auto"
            >
              Siguiente
            </Button>
          ) : (
            <Button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="w-full sm:w-auto"
            >
              {saving ? 'Guardando...' : 'Guardar y continuar'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
