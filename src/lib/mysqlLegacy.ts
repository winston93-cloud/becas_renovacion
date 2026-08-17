import mysql from 'mysql2/promise'

export interface MysqlLegacyConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

/** Nombres de tablas en MySQL (por defecto igual que Supabase). */
export function getMysqlTableNames() {
  return {
    alumno: process.env.MYSQL_TABLE_ALUMNO?.trim() || 'alumno',
    alumno_detalles: process.env.MYSQL_TABLE_ALUMNO_DETALLES?.trim() || 'alumno_detalles',
    alumno_familiar: process.env.MYSQL_TABLE_ALUMNO_FAMILIAR?.trim() || 'alumno_familiar',
    alumno_contacto: process.env.MYSQL_TABLE_ALUMNO_CONTACTO?.trim() || 'alumno_contacto',
    alumno_beca: process.env.MYSQL_TABLE_ALUMNO_BECA?.trim() || 'alumno_beca',
  }
}

export function getMysqlLegacyConfig(): MysqlLegacyConfig | null {
  const host = process.env.MYSQL_HOST?.trim()
  const user = process.env.MYSQL_USER?.trim()
  const password = process.env.MYSQL_PASSWORD
  const database = (process.env.MYSQL_DATABASE ?? 'winston_general').trim()
  const port = Number(process.env.MYSQL_PORT ?? 3306)

  if (!host || !user || password === undefined || password === '') {
    return null
  }

  return { host, port, user, password, database }
}

export async function createMysqlLegacyConnection() {
  const cfg = getMysqlLegacyConfig()
  if (!cfg) {
    throw new Error(
      'Configura MYSQL_HOST, MYSQL_USER y MYSQL_PASSWORD en .env.local (MYSQL_DATABASE=winston_general).'
    )
  }

  return mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  })
}
