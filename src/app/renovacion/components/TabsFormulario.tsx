'use client';

/**
 * 2026-07-16 - Formulario multipestaña de renovación (réplica funcional de index1.php).
 * 2026-07-16 - Rediseño premium con componentes UI institucionales.
 * 2026-07-16 - Ingresos no se precargan ni persisten; leyenda de privacidad.
 */
import { useMemo, useState } from 'react';
import type { Hermano, RenovacionPayload, RenovacionPrecarga } from '@/lib/types';
import { fetchConAcceso } from '@/lib/acceso-session';
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui';

type Props = {
  data: RenovacionPrecarga;
  onSaved: (renovacionId: string) => void;
};

const emptyHermanos = (): Hermano[] =>
  [1, 2, 3, 4].map((orden) => ({
    orden,
    nombre: '',
    edad: null,
    institucion: '',
    colegiatura_mensual: null,
  }));

export default function TabsFormulario({ data, onSaved }: Props) {
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHermanos, setShowHermanos] = useState(data.hermanos.length > 0);

  const [calle, setCalle] = useState(data.detalle?.alumno_calle || '');
  const [numero, setNumero] = useState(data.detalle?.alumno_numero || '');
  const [colonia, setColonia] = useState(data.detalle?.alumno_colonia || '');
  const [cp, setCp] = useState(data.detalle?.alumno_cp || '');

  const [mamaNombre, setMamaNombre] = useState(
    `${data.mama?.familiar_app || ''} ${data.mama?.familiar_apm || ''} ${data.mama?.familiar_nombre || ''}`.trim()
  );
  const [mamaVive, setMamaVive] = useState(Boolean(data.mama?.familiar_vive));
  const [mamaEmpresa, setMamaEmpresa] = useState(data.mama?.familiar_empresa_nombre || '');
  const [mamaPuesto, setMamaPuesto] = useState(data.mama?.familiar_empresa_puesto || '');
  const [mamaTel, setMamaTel] = useState(data.mama?.familiar_tel || '');
  const [mamaCel, setMamaCel] = useState(data.mama?.familiar_cel || '');
  const [mamaEmail, setMamaEmail] = useState(data.mama?.familiar_email || '');
  const [ingresoMadre, setIngresoMadre] = useState('0');
  // 2026-07-27 - Ingreso opcional; default 0 (no se almacena en BD)

  const [papaNombre, setPapaNombre] = useState(
    `${data.papa?.familiar_app || ''} ${data.papa?.familiar_apm || ''} ${data.papa?.familiar_nombre || ''}`.trim()
  );
  const [papaVive, setPapaVive] = useState(Boolean(data.papa?.familiar_vive));
  const [papaEmpresa, setPapaEmpresa] = useState(data.papa?.familiar_empresa_nombre || '');
  const [papaPuesto, setPapaPuesto] = useState(data.papa?.familiar_empresa_puesto || '');
  const [papaTel, setPapaTel] = useState(data.papa?.familiar_tel || '');
  const [papaCel, setPapaCel] = useState(data.papa?.familiar_cel || '');
  const [papaEmail, setPapaEmail] = useState(data.papa?.familiar_email || '');
  const [ingresoPadre, setIngresoPadre] = useState('0');
  // 2026-07-27 - Ingreso opcional; default 0 (solo va al PDF)

  const [otraBeca, setOtraBeca] = useState(Boolean(data.renovacion?.otra_beca));
  const [otraBecaPct, setOtraBecaPct] = useState(
    data.renovacion?.otra_beca_porcentaje?.toString() || ''
  );
  const [casaTipo, setCasaTipo] = useState(data.renovacion?.casa_tipo || 'propia');
  const [motivo, setMotivo] = useState(data.renovacion?.motivo || '');
  const [observaciones, setObservaciones] = useState(data.renovacion?.observaciones || '');

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
    { label: 'Datos de Beca', short: 'Beca' },
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
      const mamaParts = splitNombre(mamaNombre);
      const papaParts = splitNombre(papaNombre);

      const payload: RenovacionPayload = {
        alumno_id: data.alumno.id,
        ingreso_mensual_padre:
          ingresoPadre.trim() === '' ? 0 : Number(ingresoPadre) || 0,
        ingreso_mensual_madre:
          ingresoMadre.trim() === '' ? 0 : Number(ingresoMadre) || 0,
        motivo,
        casa_tipo: casaTipo,
        otra_beca: otraBeca,
        otra_beca_porcentaje: otraBecaPct ? Number(otraBecaPct) : null,
        observaciones,
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
          familiar_empresa_nombre: mamaEmpresa,
          familiar_empresa_puesto: mamaPuesto,
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
          familiar_empresa_nombre: papaEmpresa,
          familiar_empresa_puesto: papaPuesto,
          familiar_tel: papaTel,
          familiar_cel: papaCel,
          familiar_email: papaEmail,
        },
        hermanos: showHermanos ? hermanos : [],
      };

      const res = await fetchConAcceso('/api/renovacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar la renovación.');
      onSaved(json.renovacion_id);
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
        aria-label="Secciones del formulario"
        // 2026-07-18 - Scroll suave + fade en móvil; desktop igual
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
              <Label>Tipo de beca</Label>
              <Input value={data.beca.beca_clase} readOnly />
            </div>
            <div>
              <Label>Porcentaje</Label>
              <Input value={`${data.beca.beca_porcentaje}%`} readOnly />
            </div>
            <div>
              <Label>Ciclo escolar</Label>
              <Input
                value={`Renovación becas ciclo ${data.ciclo_label}`}
                readOnly
              />
            </div>
            <div>
              <Label>Promedio requerido</Label>
              <Input
                value={data.beca.beca_promedio_requerido || ''}
                readOnly
              />
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
              <Label htmlFor="ingresoPadre">Ingreso mensual (opcional)</Label>
              <Input
                id="ingresoPadre"
                type="number"
                min={0}
                value={ingresoPadre}
                onChange={(e) => setIngresoPadre(e.target.value)}
                placeholder="0"
              />
              {/* 2026-07-16 - Leyenda de privacidad: sueldo no se almacena */}
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                Por políticas de privacidad, el salario de los padres no se
                almacena en el sistema; solo se incluye en el documento de
                solicitud enviado a coordinación.
              </p>
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
              <Label htmlFor="papaTel">Teléfono</Label>
              <Input
                id="papaTel"
                value={papaTel}
                onChange={(e) => setPapaTel(e.target.value)}
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
              <Label htmlFor="papaEmail">Email</Label>
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
              <Label htmlFor="ingresoMadre">Ingreso mensual (opcional)</Label>
              <Input
                id="ingresoMadre"
                type="number"
                min={0}
                value={ingresoMadre}
                onChange={(e) => setIngresoMadre(e.target.value)}
                placeholder="0"
              />
              {/* 2026-07-16 - Leyenda de privacidad: sueldo no se almacena */}
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                Por políticas de privacidad, el salario de los padres no se
                almacena en el sistema; solo se incluye en el documento de
                solicitud enviado a coordinación.
              </p>
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
              <Label htmlFor="mamaTel">Teléfono</Label>
              <Input
                id="mamaTel"
                value={mamaTel}
                onChange={(e) => setMamaTel(e.target.value)}
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
              <Label htmlFor="mamaEmail">Email</Label>
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
                <Label htmlFor="otraBeca">¿Otra beca?</Label>
                <Select
                  id="otraBeca"
                  value={otraBeca ? '1' : '0'}
                  onChange={(e) => setOtraBeca(e.target.value === '1')}
                >
                  <option value="0">No</option>
                  <option value="1">Sí</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="otraBecaPct">% otra beca</Label>
                <Input
                  id="otraBecaPct"
                  type="number"
                  min={0}
                  value={otraBecaPct}
                  onChange={(e) => setOtraBecaPct(e.target.value)}
                  disabled={!otraBeca}
                />
              </div>
              <div>
                <Label htmlFor="casaTipo">Tipo de vivienda</Label>
                <Select
                  id="casaTipo"
                  value={casaTipo}
                  onChange={(e) => setCasaTipo(e.target.value)}
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
                maxLength={500}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
              />
              <p className="mt-1.5 text-xs text-text-secondary">
                {motivo.length}/500
              </p>
            </div>

            <div>
              <Label htmlFor="observaciones">Observaciones (opcional)</Label>
              <Textarea
                id="observaciones"
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowHermanos((v) => !v)}
            >
              {showHermanos ? 'Ocultar hermanos' : 'Agregar hermanos'}
            </Button>

            {showHermanos && (
              <div className="space-y-4">
                {hermanos.map((h) => (
                  <div
                    key={h.orden}
                    className="rounded-[12px] border border-border bg-bg p-4"
                  >
                    <h4 className="mb-3 text-sm font-semibold text-text">
                      Hermano {h.orden}
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        placeholder="Nombre completo"
                        value={h.nombre}
                        onChange={(e) =>
                          updateHermano(h.orden, { nombre: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        placeholder="Edad"
                        value={h.edad ?? ''}
                        onChange={(e) =>
                          updateHermano(h.orden, {
                            edad: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                      <Input
                        placeholder="Institución"
                        value={h.institucion}
                        onChange={(e) =>
                          updateHermano(h.orden, { institucion: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        placeholder="Colegiatura mensual"
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        {/* 2026-07-18 - Sticky + safe-area; CTAs full-width en móvil */}
        <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t border-border bg-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              disabled={tab === 0}
              onClick={() => setTab((t) => Math.max(0, t - 1))}
              className="flex-1 sm:flex-none"
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={tab === tabs.length - 1}
              onClick={() => setTab((t) => Math.min(tabs.length - 1, t + 1))}
              className="flex-1 sm:flex-none"
            >
              Siguiente
            </Button>
          </div>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? 'Guardando...' : 'Guardar e ir a documentos'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
