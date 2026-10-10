// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Cliente de InsForge de SOLO LECTURA.
 * Única puerta hacia la base de producción; cada consulta pasa por validarSoloLectura().
 */

import 'server-only'
import { validarSoloLectura } from './candado'

export type FilaInsforge = Record<string, unknown>

export class InsforgeNoDisponible extends Error {
  constructor(motivo: string) {
    super(`No se pudo leer InsForge: ${motivo}`)
    this.name = 'InsforgeNoDisponible'
  }
}

function configuracion() {
  const url = process.env.INSFORGE_URL?.replace(/\/$/, '')
  const llave = process.env.INSFORGE_API_KEY
  if (!url || !llave) throw new InsforgeNoDisponible('faltan INSFORGE_URL o INSFORGE_API_KEY en .env.local')
  return { url, llave }
}

export async function consultar(sql: string): Promise<FilaInsforge[]> {
  validarSoloLectura(sql)
  const { url, llave } = configuracion()
  let res: Response
  try {
    res = await fetch(`${url}/api/database/advance/rawsql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llave}` },
      body: JSON.stringify({ query: sql }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    throw new InsforgeNoDisponible(e instanceof Error ? e.message : 'sin conexión')
  }
  const cuerpo = (await res.json().catch(() => ({}))) as { rows?: FilaInsforge[]; data?: FilaInsforge[]; message?: string; error?: string }
  if (!res.ok) throw new InsforgeNoDisponible(`HTTP ${res.status} ${cuerpo.message ?? cuerpo.error ?? ''}`.trim())
  return cuerpo.rows ?? cuerpo.data ?? []
}

/** Verifica conexión con una lectura mínima. */
export async function probarConexion(): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const filas = await consultar('SELECT count(*) AS n FROM pago_boucher_precio')
    return { ok: true, mensaje: `Conectado a InsForge (${filas[0]?.n ?? 0} precios).` }
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
