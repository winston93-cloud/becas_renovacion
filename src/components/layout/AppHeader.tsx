/**
 * 2026-07-16 - Header tipográfico institucional (sin login).
 * 2026-07-17 - Título del trámite configurable (Solicitud vs Renovación).
 * 2026-07-22 - Botón cerrar sesión cuando hay trámite/sesión activa.
 */
import { LogoutButton } from './LogoutButton';

type Props = {
  titulo?: string;
  alumnoNombre?: string | null;
  alumnoRef?: string | null;
  cicloLabel?: string | null;
};

export function AppHeader({
  titulo = 'Portal de Becas',
  alumnoNombre,
  alumnoRef,
  cicloLabel,
}: Props) {
  const hasAlumno = Boolean(alumnoNombre || alumnoRef);

  return (
    <header className="border-b border-white/10 bg-primary text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/65">
            Instituto Winston Churchill
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
            {titulo}
          </h1>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          {cicloLabel && (
            <span className="rounded-[10px] bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
              Ciclo {cicloLabel}
            </span>
          )}
          {hasAlumno ? (
            <div className="min-w-0 max-w-full rounded-[10px] bg-white/10 px-3 py-1.5 text-left sm:max-w-xs sm:text-right">
              {alumnoNombre && (
                <p className="truncate text-sm font-medium leading-tight text-white">
                  {alumnoNombre}
                </p>
              )}
              {alumnoRef && (
                <p className="text-xs text-white/70">No. Control {alumnoRef}</p>
              )}
            </div>
          ) : (
            <span className="text-xs text-white/60">Acceso familiar</span>
          )}
          <LogoutButton forceShow={hasAlumno} />
        </div>
      </div>
    </header>
  );
}
