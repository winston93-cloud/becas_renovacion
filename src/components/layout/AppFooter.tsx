/**
 * 2026-07-16 - Footer discreto con versión del sistema.
 * 2026-07-17 - Nombre neutro: Portal de Becas (cubre renovación y solicitud).
 */
const APP_VERSION = '0.1.0';

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left">
        <p className="text-xs text-text-secondary">
          Instituto Winston Churchill · Sistema de Becas
        </p>
        <p className="text-xs text-placeholder">
          Portal de Becas v{APP_VERSION}
        </p>
      </div>
    </footer>
  );
}
