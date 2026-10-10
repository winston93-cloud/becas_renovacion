// 2026-09-30: el candado de InsForge rechaza cualquier escritura o tabla no autorizada.
import { describe, expect, test } from 'vitest'
import { ConsultaNoPermitida, num, txt, validarSoloLectura } from '@/lib/sep/insforge/candado'

const bloquea = (sql: string) => expect(() => validarSoloLectura(sql)).toThrow(ConsultaNoPermitida)

describe('candado de solo lectura', () => {
  test('permite SELECT sobre tablas autorizadas', () => {
    expect(() => validarSoloLectura('SELECT alumno_id FROM alumno WHERE alumno_ref = 91592')).not.toThrow()
    expect(() =>
      validarSoloLectura('SELECT a.alumno_id FROM alumno a LEFT JOIN alumno_cambio_ciclo_respaldo r ON r.alumno_id = a.alumno_id')
    ).not.toThrow()
    expect(() => validarSoloLectura('WITH p AS (SELECT * FROM pago_detalle) SELECT * FROM p')).not.toThrow()
    expect(() => validarSoloLectura("SELECT * FROM alumno WHERE alumno_nombre ILIKE '%delete%'")).not.toThrow()
  })

  test.each([
    'INSERT INTO alumno (alumno_ref) VALUES (1)',
    'UPDATE pago_detalle SET pago_importe = 0',
    'DELETE FROM pago_detalle',
    'DROP TABLE alumno',
    'TRUNCATE pago_detalle',
    'ALTER TABLE alumno ADD COLUMN x int',
    'CREATE TABLE x (id int)',
    'GRANT ALL ON alumno TO anon',
    'SELECT 1 FROM alumno; DELETE FROM alumno',
    'WITH x AS (DELETE FROM alumno RETURNING *) SELECT * FROM x',
    'SELECT * INTO copia FROM alumno',
    'SELECT * FROM alumno -- comentario',
    'SELECT * FROM alumno /* x */',
    'SELECT pg_sleep(10) FROM alumno',
    'SELECT * FROM auth.users',
    'SELECT * FROM usuarios',
    'SELECT * FROM "alumno"',
    'COPY alumno TO STDOUT',
    '',
  ])('bloquea: %s', (sql) => bloquea(sql))

  test('literales seguros', () => {
    expect(num('91592')).toBe('91592')
    expect(() => num('1 OR 1=1')).toThrow(ConsultaNoPermitida)
    expect(txt("O'Brien")).toBe("'O''Brien'")
    expect(() => txt('a\\b')).toThrow(ConsultaNoPermitida)
  })
})
