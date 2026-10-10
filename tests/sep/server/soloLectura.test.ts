// 2026-10-07 - Prueba del candado de solo lectura del cliente InsForge (modo local) con un cliente falso, sin red.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@insforge/sdk', () => ({ createAdminClient: () => ({}) }));

import { EscrituraBloqueada, soloLectura } from '@/lib/insforge-server';

function clienteFalso() {
  const consulta = {
    select: vi.fn(() => 'select-ok'),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  };
  const bucket = { download: vi.fn(() => 'download-ok'), upload: vi.fn(), uploadAuto: vi.fn(), remove: vi.fn() };
  return {
    consulta,
    bucket,
    cliente: {
      database: { from: vi.fn<(tabla: string) => typeof consulta>(() => consulta), rpc: vi.fn() },
      storage: { from: vi.fn<(nombre: string) => typeof bucket>(() => bucket), createBucket: vi.fn(), deleteBucket: vi.fn() },
      emails: { send: vi.fn() },
      functions: { invoke: vi.fn() },
    },
  };
}

describe('soloLectura', () => {
  it('deja pasar lecturas de database y storage', () => {
    const { cliente } = clienteFalso();
    const c = soloLectura(cliente);
    expect(c.database.from('alumno').select()).toBe('select-ok');
    expect(c.storage.from('docs').download()).toBe('download-ok');
  });

  it.each(['insert', 'update', 'upsert', 'delete'] as const)('bloquea database.from().%s sin llamar al original', (m) => {
    const { cliente, consulta } = clienteFalso();
    const c = soloLectura(cliente);
    expect(() => (c.database.from('alumno')[m] as () => void)()).toThrow(EscrituraBloqueada);
    expect(consulta[m]).not.toHaveBeenCalled();
  });

  it('bloquea rpc, storage, emails y functions', () => {
    const { cliente, bucket } = clienteFalso();
    const c = soloLectura(cliente);
    expect(() => c.database.rpc()).toThrow(EscrituraBloqueada);
    expect(() => c.storage.from('docs').upload()).toThrow(EscrituraBloqueada);
    expect(() => c.storage.from('docs').uploadAuto()).toThrow(EscrituraBloqueada);
    expect(() => c.storage.from('docs').remove()).toThrow(EscrituraBloqueada);
    expect(() => c.storage.createBucket()).toThrow(EscrituraBloqueada);
    expect(() => c.storage.deleteBucket()).toThrow(EscrituraBloqueada);
    expect(() => c.emails.send()).toThrow(EscrituraBloqueada);
    expect(() => c.functions.invoke()).toThrow(EscrituraBloqueada);
    expect(bucket.upload).not.toHaveBeenCalled();
    expect(cliente.emails.send).not.toHaveBeenCalled();
  });
});
