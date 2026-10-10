/**
 * 2026-10-09 - El "Reporte de Sistemas" ahora es el tablero de Dirección General.
 */
import { redirect } from 'next/navigation';

export default function SistemasSepPage() {
  redirect('/admin/sep/direccion');
}
