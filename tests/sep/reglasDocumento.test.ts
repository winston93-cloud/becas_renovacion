// 2026-10-07 - Reglas provisionales del documento SEP (sin muestra real todavía).
import { describe, expect, test } from 'vitest';
import { analizarTexto, buscarNombre, porcentajeProbable } from '@/lib/sep/reglasDocumento';

const DOC = `SECRETARÍA DE EDUCACIÓN PÚBLICA. Programa de Becas en Escuelas Particulares Incorporadas.
Se autoriza al alumno(a) JUANITO PÉREZ LÓPEZ, inscrito en el Instituto Winston Churchill,
una beca del 50 % para el ciclo escolar 2026-2027.`;

describe('documento SEP', () => {
  test('documento correcto: nombre, porcentaje y palabras clave', () => {
    const d = analizarTexto(DOC, 'PEREZ LOPEZ JUANITO');
    expect(d.legible).toBe(true);
    expect(d.pareceDocumentoSep).toBe(true);
    expect(d.coincideNombre).toBe(true);
    expect(d.porcentajeDetectado).toBe(50);
    expect(d.valido).toBe(true);
    expect(d.motivos).toEqual([]);
  });

  test('otro alumno: no es válido y lo explica', () => {
    const d = analizarTexto(DOC, 'GARCIA RUIZ MARIA');
    expect(d.coincideNombre).toBe(false);
    expect(d.valido).toBe(false);
    expect(d.motivos.join(' ')).toMatch(/nombre/);
  });

  test('un error de dedo en el nombre sí coincide', () => {
    expect(buscarNombre(DOC, 'PERES LOPEZ JUANITO').puntaje).toBeGreaterThanOrEqual(0.85);
  });

  test('sin texto suficiente = escaneo, revisión manual', () => {
    const d = analizarTexto('   ', 'PEREZ LOPEZ JUANITO');
    expect(d.legible).toBe(false);
    expect(d.metodo).toBe('sin-texto');
    expect(d.valido).toBe(false);
  });

  test('documento que no es de la SEP', () => {
    const d = analizarTexto('Recibo de pago de colegiatura de JUANITO PEREZ LOPEZ por 50 % de descuento.', 'PEREZ LOPEZ JUANITO');
    expect(d.pareceDocumentoSep).toBe(false);
    expect(d.valido).toBe(false);
  });

  test('porcentaje más cercano a "beca" y aviso si hay varios', () => {
    const p = porcentajeProbable('Aprovechamiento 95 %. Se otorga beca del 30 por ciento.');
    expect(p.valor).toBe(30);
    expect(p.todos).toEqual([95, 30]);
  });
});
