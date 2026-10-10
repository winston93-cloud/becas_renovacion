// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Candado de SOLO LECTURA para InsForge (producción Winston Servicios).
 *
 * Toda consulta a InsForge pasa por aquí. Se rechaza cualquier cosa que no sea un SELECT
 * sobre las tablas autorizadas. No existe ninguna función de escritura en este proyecto.
 */

export const TABLAS_PERMITIDAS = new Set([
  'alumno',
  'alumno_beca',
  'alumno_cambio_ciclo_respaldo',
  'pago_detalle',
  'pago_boucher_precio',
  // 2026-10-09 - Solo lectura: correos de los papás (avisos de Beca SEP) y nombre de la beca sustituida.
  'alumno_familiar',
  'becas_concepto_beca',
])

const PALABRAS_PROHIBIDAS = [
  'insert', 'update', 'delete', 'merge', 'upsert', 'drop', 'alter', 'create', 'truncate', 'grant',
  'revoke', 'copy', 'call', 'do', 'execute', 'exec', 'vacuum', 'analyze', 'comment', 'set', 'reset',
  'lock', 'refresh', 'reindex', 'cluster', 'listen', 'notify', 'prepare', 'deallocate', 'discard',
  'security', 'owner', 'into', 'returning', 'pg_sleep', 'pg_read_file', 'pg_terminate_backend', 'dblink',
  'lo_import', 'lo_export',
]
const REGEX_PROHIBIDAS = new RegExp(`\\b(${PALABRAS_PROHIBIDAS.join('|')})\\b`, 'i')

export class ConsultaNoPermitida extends Error {
  constructor(motivo: string) {
    super(`Consulta bloqueada (InsForge es solo lectura): ${motivo}`)
    this.name = 'ConsultaNoPermitida'
  }
}

/** Quita literales de texto para que su contenido no confunda las validaciones. */
const sinLiterales = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''")

/** Lanza ConsultaNoPermitida si la consulta no es un SELECT sobre tablas autorizadas. */
export function validarSoloLectura(sql: string): void {
  const limpio = sinLiterales(String(sql ?? '')).trim()
  if (!limpio) throw new ConsultaNoPermitida('consulta vacía')
  if (!/^(select|with)\b/i.test(limpio)) throw new ConsultaNoPermitida('solo se permite SELECT')
  if (limpio.includes(';')) throw new ConsultaNoPermitida('no se permiten varias instrucciones')
  if (/--|\/\*|\*\//.test(limpio)) throw new ConsultaNoPermitida('no se permiten comentarios')
  if (/"/.test(limpio)) throw new ConsultaNoPermitida('no se permiten identificadores entre comillas')
  const prohibida = limpio.match(REGEX_PROHIBIDAS)
  if (prohibida) throw new ConsultaNoPermitida(`palabra no permitida "${prohibida[1]}"`)

  const ctes = new Set(Array.from(limpio.matchAll(/\b([a-z_][a-z0-9_]*)\s+as\s*\(/gi)).map((m) => m[1].toLowerCase()))
  const tablas = Array.from(limpio.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_.]*)/gi)).map((m) => m[1].toLowerCase())
  if (!tablas.length) throw new ConsultaNoPermitida('no se encontró ninguna tabla')
  for (const t of tablas) {
    const nombre = t.startsWith('public.') ? t.slice(7) : t
    if (nombre.includes('.')) throw new ConsultaNoPermitida(`esquema no permitido "${t}"`)
    if (!TABLAS_PERMITIDAS.has(nombre) && !ctes.has(nombre)) throw new ConsultaNoPermitida(`tabla no autorizada "${nombre}"`)
  }
}

/** Literal numérico seguro (lanza si no es un número finito). */
export function num(v: unknown): string {
  const n = Number(v)
  if (!Number.isFinite(n)) throw new ConsultaNoPermitida(`valor numérico inválido "${String(v)}"`)
  return String(n)
}

/** Literal de texto seguro: escapa comillas y rechaza caracteres de control. */
export function txt(v: unknown): string {
  const s = String(v ?? '')
  if (/[\u0000-\u001f\\]/.test(s)) throw new ConsultaNoPermitida('texto con caracteres no permitidos')
  return `'${s.replace(/'/g, "''")}'`
}
