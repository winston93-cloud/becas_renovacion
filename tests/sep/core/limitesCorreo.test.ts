/**
 * 2026-10-09 - Límites de frecuencia de correos Beca SEP a familias (anti-spam).
 */
import { describe, expect, it } from 'vitest';
import { motivoNoEnviarCorreo, siguienteCorreoPermitido } from '@/lib/sep/limitesCorreo';
import type { EventoSep, TipoCorreoSep } from '@/lib/sep/tipos';

const AHORA = Date.parse('2026-10-09T18:00:00Z');
const H = 60 * 60 * 1000;
const correo = (tipo: TipoCorreoSep, horasAtras: number, enviado = true): EventoSep => ({
  fecha: new Date(AHORA - horasAtras * H).toISOString(),
  actor: 'ce_pri',
  accion: tipo === 'pago' ? 'aviso_pago' : 'correo_familia',
  correo: { tipo, enviado },
});

describe('límites de correo a familias', () => {
  it('el correo de "recibido" ya no se envía', () => {
    expect(motivoNoEnviarCorreo('recibido', [], AHORA)).toMatch(/no se envía/);
  });

  it('sin correos previos se puede enviar', () => {
    expect(motivoNoEnviarCorreo('aplicada', [], AHORA)).toBeNull();
    expect(motivoNoEnviarCorreo('pago', [], AHORA)).toBeNull();
  });

  it('aviso de pagos: uno por semana', () => {
    expect(motivoNoEnviarCorreo('pago', [correo('pago', 24 * 3)], AHORA)).toMatch(/a partir del/);
    expect(siguienteCorreoPermitido('pago', [correo('pago', 24 * 3)], AHORA)?.getTime()).toBe(AHORA + 24 * 4 * H);
    expect(motivoNoEnviarCorreo('pago', [correo('pago', 24 * 8)], AHORA)).toBeNull();
  });

  it('máximo 2 correos al día; la confirmación de beca aplicada no se bloquea', () => {
    const hist = [correo('correccion', 5), correo('actualizada', 30), correo('correccion', 3)];
    expect(motivoNoEnviarCorreo('pago', hist, AHORA)).toMatch(/2 correos/);
    expect(motivoNoEnviarCorreo('aplicada', hist, AHORA)).toBeNull();
  });

  it('los correos que no salieron no cuentan', () => {
    expect(motivoNoEnviarCorreo('pago', [correo('pago', 1, false)], AHORA)).toBeNull();
  });

  it('doble clic en Aplicar no manda dos confirmaciones', () => {
    expect(motivoNoEnviarCorreo('aplicada', [correo('aplicada', 0.1)], AHORA)).toMatch(/hace poco/);
  });
});
