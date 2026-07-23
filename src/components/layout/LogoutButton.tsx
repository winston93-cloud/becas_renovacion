'use client';

/**
 * 2026-07-22 - Cierra la sesión familiar (borra token) y vuelve al inicio.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {
  clearAccesoSession,
  getAccesoToken,
} from '@/lib/acceso-session';

type Props = {
  /** Mostrar aunque aún no se haya leído sessionStorage (p. ej. ya hay alumno en pantalla). */
  forceShow?: boolean;
};

export function LogoutButton({ forceShow = false }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(forceShow);

  useEffect(() => {
    setVisible(forceShow || Boolean(getAccesoToken()));
  }, [forceShow]);

  if (!visible) return null;

  function handleLogout() {
    clearAccesoSession();
    setVisible(false);
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex touch-manipulation items-center gap-1.5 rounded-[10px] border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/95 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label="Cerrar sesión"
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Cerrar sesión
    </button>
  );
}
