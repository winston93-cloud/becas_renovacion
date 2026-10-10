/**
 * 2026-10-07 - Almacén del trámite Beca SEP.
 * Modo local: archivos en .local-sep/ (InsForge queda intacto).
 * 2026-10-10 - Fuera de modo local: tabla public.becas_sep_solicitud (columna `datos` con la solicitud
 *              completa) y bucket privado becas-sep-documentos (migrations/20261010190000_becas-sep-solicitud.sql).
 */
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { esModoLocalSoloLectura } from '@/lib/modo-local';
import type { EstadoSep, SolicitudSep } from '@/lib/sep/tipos';

export type FiltroSep = { niveles?: number[]; estados?: EstadoSep[]; ciclo?: number };

export interface SepRepo {
  listar(f?: FiltroSep): Promise<SolicitudSep[]>;
  obtener(id: string): Promise<SolicitudSep | null>;
  porAlumno(alumnoId: number, ciclo: number): Promise<SolicitudSep | null>;
  guardar(s: SolicitudSep): Promise<SolicitudSep>;
  guardarArchivo(solicitudId: string, nombre: string, bytes: Buffer): Promise<string>;
  leerArchivo(clave: string): Promise<Buffer>;
}

export function filtrar(lista: SolicitudSep[], f: FiltroSep = {}): SolicitudSep[] {
  return lista
    .filter((s) => (f.ciclo ? s.ciclo === f.ciclo : true))
    .filter((s) => (f.estados?.length ? f.estados.includes(s.estado) : true))
    .filter((s) => (f.niveles ? s.nivel != null && f.niveles.includes(s.nivel) : true))
    .sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn));
}

class RepoLocal implements SepRepo {
  private cola: Promise<unknown> = Promise.resolve();

  constructor(private readonly dir: string) {}

  private get archivoJson() {
    return path.join(this.dir, 'solicitudes.json');
  }

  private async leerTodo(): Promise<SolicitudSep[]> {
    try {
      return JSON.parse(await fs.readFile(this.archivoJson, 'utf8')) as SolicitudSep[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  /** Escrituras en serie y atómicas (archivo temporal + rename). */
  private enCola<T>(fn: () => Promise<T>): Promise<T> {
    const r = this.cola.then(fn, fn);
    this.cola = r.catch(() => undefined);
    return r;
  }

  async listar(f?: FiltroSep) {
    return filtrar(await this.leerTodo(), f);
  }

  async obtener(id: string) {
    return (await this.leerTodo()).find((s) => s.id === id) ?? null;
  }

  async porAlumno(alumnoId: number, ciclo: number) {
    return (await this.leerTodo()).find((s) => s.alumnoId === alumnoId && s.ciclo === ciclo) ?? null;
  }

  guardar(s: SolicitudSep) {
    return this.enCola(async () => {
      const todas = await this.leerTodo();
      const i = todas.findIndex((x) => x.id === s.id);
      const fila = { ...s, actualizadaEn: new Date().toISOString() };
      if (i >= 0) todas[i] = fila;
      else todas.push(fila);
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = `${this.archivoJson}.${randomUUID()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(todas, null, 2));
      await fs.rename(tmp, this.archivoJson);
      return fila;
    });
  }

  async guardarArchivo(solicitudId: string, nombre: string, bytes: Buffer) {
    const seguro = nombre.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const clave = `documentos/${solicitudId.replace(/[^a-zA-Z0-9-]/g, '')}/${Date.now()}-${seguro}`;
    const destino = path.join(this.dir, clave);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, bytes);
    return clave;
  }

  async leerArchivo(clave: string) {
    const destino = path.resolve(this.dir, clave);
    if (!destino.startsWith(path.resolve(this.dir) + path.sep)) {
      throw new Error('Ruta de documento inválida.');
    }
    return fs.readFile(destino);
  }
}

const TABLA_SEP = 'becas_sep_solicitud';
export const BUCKET_SEP = 'becas-sep-documentos';

const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

type FilaSep = { datos: SolicitudSep };

function errorInsforge(operacion: string, error: unknown): Error {
  const msg = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  return new Error(`Beca SEP (${operacion}): ${msg}`);
}

/** 2026-10-10 - Trámite en InsForge: una fila por alumno y ciclo; la solicitud completa va en `datos`. */
class RepoInsforge implements SepRepo {
  private get db() {
    return getInsforgeAdmin().database;
  }

  private get bucket() {
    return getInsforgeAdmin().storage.from(BUCKET_SEP);
  }

  async listar(f: FiltroSep = {}) {
    let q = this.db.from(TABLA_SEP).select('datos');
    if (f.ciclo) q = q.eq('ciclo_escolar', f.ciclo);
    if (f.estados?.length) q = q.in('estado', f.estados);
    if (f.niveles) q = q.in('alumno_nivel', f.niveles.length ? f.niveles : [-1]);
    const { data, error } = await q;
    if (error) throw errorInsforge('listar', error);
    return filtrar(((data ?? []) as FilaSep[]).map((r) => r.datos), f);
  }

  async obtener(id: string) {
    const { data, error } = await this.db.from(TABLA_SEP).select('datos').eq('id', id).maybeSingle();
    if (error) throw errorInsforge('obtener', error);
    return (data as FilaSep | null)?.datos ?? null;
  }

  async porAlumno(alumnoId: number, ciclo: number) {
    const { data, error } = await this.db
      .from(TABLA_SEP)
      .select('datos')
      .eq('alumno_id', alumnoId)
      .eq('ciclo_escolar', ciclo)
      .maybeSingle();
    if (error) throw errorInsforge('porAlumno', error);
    return (data as FilaSep | null)?.datos ?? null;
  }

  async guardar(s: SolicitudSep) {
    const actualizadaEn = new Date().toISOString();
    const fila = { ...s, actualizadaEn };
    const { error } = await this.db.from(TABLA_SEP).upsert(
      [
        {
          id: s.id,
          alumno_id: s.alumnoId,
          alumno_ref: s.alumnoRef,
          ciclo_escolar: s.ciclo,
          alumno_nivel: s.nivel,
          estado: s.estado,
          datos: fila,
          creado_en: s.creadaEn,
          actualizado_en: actualizadaEn,
        },
      ],
      { onConflict: 'id' }
    );
    if (error) throw errorInsforge('guardar', error);
    return fila;
  }

  async guardarArchivo(solicitudId: string, nombre: string, bytes: Buffer) {
    const seguro = nombre.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const clave = `${solicitudId.replace(/[^a-zA-Z0-9-]/g, '')}/${Date.now()}-${seguro}`;
    const ext = seguro.split('.').pop()?.toLowerCase() ?? '';
    const blob = new Blob([new Uint8Array(bytes)], { type: MIME_POR_EXTENSION[ext] ?? 'application/octet-stream' });
    const { data, error } = await this.bucket.upload(clave, blob);
    if (error || !data) throw errorInsforge('subir documento', error ?? 'sin respuesta');
    // InsForge puede renombrar la clave si ya existe: se guarda la que devuelve.
    return data.key;
  }

  async leerArchivo(clave: string) {
    const { data, error } = await this.bucket.download(clave);
    if (error || !data) throw errorInsforge('leer documento', error ?? 'no encontrado');
    return Buffer.from(await data.arrayBuffer());
  }
}

let repo: SepRepo | null = null;

/** 2026-10-09 - Carpeta de datos locales del trámite (también guarda la vista previa de los correos). */
export function dirDatosSep(): string {
  return process.env.BECAS_SEP_DATA_DIR?.trim() || path.join(process.cwd(), '.local-sep');
}

/** 2026-10-10 - Local: archivos en .local-sep/. Vercel / sin modo local: InsForge. */
export function getSepRepo(): SepRepo {
  if (!repo) repo = esModoLocalSoloLectura() ? new RepoLocal(dirDatosSep()) : new RepoInsforge();
  return repo;
}

export function nuevoIdSep(): string {
  return randomUUID();
}
