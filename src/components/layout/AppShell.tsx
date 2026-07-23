import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';

/**
 * 2026-07-16 - Shell común: header, contenido centrado y footer.
 * 2026-07-17 - Variante medium; título del trámite (Solicitud / Renovación / Portal).
 */
type Props = {
  children: ReactNode;
  titulo?: string;
  alumnoNombre?: string | null;
  alumnoRef?: string | null;
  cicloLabel?: string | null;
  /** max-w-lg — formularios estrechos */
  narrow?: boolean;
  /** max-w-2xl — home / selector de trámite */
  medium?: boolean;
};

export function AppShell({
  children,
  titulo,
  alumnoNombre,
  alumnoRef,
  cicloLabel,
  narrow = false,
  medium = false,
}: Props) {
  const widthClass = narrow
    ? 'max-w-lg'
    : medium
      ? 'max-w-2xl'
      : 'max-w-5xl';

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AppHeader
        titulo={titulo}
        alumnoNombre={alumnoNombre}
        alumnoRef={alumnoRef}
        cicloLabel={cicloLabel}
      />
      <main
        className={[
          'mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10',
          widthClass,
        ].join(' ')}
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
