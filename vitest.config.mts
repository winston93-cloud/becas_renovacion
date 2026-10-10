// 2026-10-07 - Pruebas del motor Beca SEP (copiado de BECAS-SEP-NUEVO) y del módulo SEP.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/sep/server-only-vacio.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
