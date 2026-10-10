// 2026-10-09 - Beca SEP solo para alumnos activos e inscritos en el ciclo vigente.
import { describe, expect, test } from 'vitest';
import { motivoNoPuedeTramitar } from '@/lib/sep/servicio';
import type { AlumnoBasico } from '@/lib/sep/insforge/consultas';

const alumno = (cambios: Partial<AlumnoBasico> = {}): AlumnoBasico => ({
  alumnoId: 1,
  alumnoRef: 20000,
  nombre: 'PRUEBA ALUMNO',
  nivel: 3,
  grado: 2,
  plan: 10,
  cicloAlumno: 23,
  activo: true,
  ...cambios,
});

describe('motivoNoPuedeTramitar', () => {
  test('activo e inscrito en el ciclo vigente: puede tramitar', () => {
    expect(motivoNoPuedeTramitar(alumno(), 23)).toBeNull();
  });

  test('ya reinscrito al ciclo siguiente: puede tramitar', () => {
    expect(motivoNoPuedeTramitar(alumno({ cicloAlumno: 24 }), 23)).toBeNull();
  });

  test('dado de baja: no puede', () => {
    expect(motivoNoPuedeTramitar(alumno({ activo: false }), 23)).toContain('dado de baja');
  });

  test('inscrito en un ciclo anterior: no puede', () => {
    expect(motivoNoPuedeTramitar(alumno({ cicloAlumno: 19 }), 23)).toContain('no está inscrito');
  });

  test('sin ciclo registrado: no puede', () => {
    expect(motivoNoPuedeTramitar(alumno({ cicloAlumno: null }), 23)).toContain('no está inscrito');
  });
});
