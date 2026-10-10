'use client';

/**
 * 2026-10-07 - Imprimir la hoja de cálculo Beca SEP.
 */
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui';

export function BotonImprimirSep({ texto = 'Imprimir hoja' }: { texto?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      {texto}
    </Button>
  );
}
