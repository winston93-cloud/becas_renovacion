/**
 * 2026-07-16 - Cliente InsForge solo servidor (API key de servicio).
 * Nunca importar este módulo desde componentes cliente.
 * 2026-10-07 - En modo local (BECAS_LOCAL_SOLO_LECTURA=1) se envuelve en un candado de solo lectura:
 *              cualquier insert/update/upsert/delete, rpc, subida o borrado en Storage lanza error.
 */
import { createAdminClient } from '@insforge/sdk';
import { esModoLocalSoloLectura } from '@/lib/modo-local';

export class EscrituraBloqueada extends Error {
  constructor(operacion: string) {
    super(
      `Escritura bloqueada en modo local (InsForge solo lectura): ${operacion}`
    );
    this.name = 'EscrituraBloqueada';
  }
}

const ESCRITURA_DB = new Set(['insert', 'update', 'upsert', 'delete']);
const ESCRITURA_STORAGE = new Set([
  'upload',
  'uploadAuto',
  'remove',
  'update',
  'move',
  'copy',
  'createBucket',
  'deleteBucket',
  'updateBucket',
]);

type Objeto = Record<PropertyKey, unknown>;

function enlazar(target: object, prop: PropertyKey): unknown {
  const v = Reflect.get(target, prop);
  return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
}

/** Envuelve un objeto y bloquea los métodos de la lista. */
function bloquear<T extends object>(obj: T, metodos: Set<string>, etiqueta: string): T {
  return new Proxy(obj, {
    get(target, prop) {
      if (typeof prop === 'string' && metodos.has(prop)) {
        return () => {
          throw new EscrituraBloqueada(`${etiqueta}.${prop}`);
        };
      }
      return enlazar(target, prop);
    },
  });
}

function candadoDb<T extends object>(db: T): T {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'rpc') {
        return () => {
          throw new EscrituraBloqueada('database.rpc');
        };
      }
      if (prop === 'from') {
        const from = (target as Objeto).from as (...a: unknown[]) => object;
        return (...args: unknown[]) =>
          bloquear(from.apply(target, args), ESCRITURA_DB, `database.from(${String(args[0])})`);
      }
      return enlazar(target, prop);
    },
  });
}

function candadoStorage<T extends object>(storage: T): T {
  return new Proxy(bloquear(storage, ESCRITURA_STORAGE, 'storage'), {
    get(target, prop) {
      if (prop === 'from') {
        const from = (storage as Objeto).from as (...a: unknown[]) => object;
        return (...args: unknown[]) =>
          bloquear(from.apply(storage, args), ESCRITURA_STORAGE, `storage.from(${String(args[0])})`);
      }
      return Reflect.get(target, prop);
    },
  });
}

/** Cliente con candado: solo lecturas en database y storage; emails y functions bloqueados. */
export function soloLectura<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      const v = Reflect.get(target, prop);
      if (prop === 'database' && v && typeof v === 'object') return candadoDb(v);
      if (prop === 'storage' && v && typeof v === 'object') return candadoStorage(v);
      if ((prop === 'emails' || prop === 'functions') && v && typeof v === 'object') {
        return new Proxy(v, {
          get() {
            return () => {
              throw new EscrituraBloqueada(String(prop));
            };
          },
        });
      }
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}

export function getInsforgeAdmin() {
  const baseUrl = process.env.INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('Faltan INSFORGE_URL o INSFORGE_API_KEY en el entorno del servidor.');
  }

  const client = createAdminClient({ baseUrl, apiKey });
  return esModoLocalSoloLectura() ? soloLectura(client) : client;
}
