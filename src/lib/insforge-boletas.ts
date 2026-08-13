/**
 * 2026-08-13 - Cliente InsForge del proyecto Boletas (solo servidor).
 * Hosting MySQL sale de servicio; promedios de renovación viven aquí.
 */
import { createAdminClient } from '@insforge/sdk';

export function getInsforgeBoletasAdmin() {
  const baseUrl = process.env.INSFORGE_BOLETAS_URL?.trim();
  const apiKey = process.env.INSFORGE_BOLETAS_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      'Faltan INSFORGE_BOLETAS_URL o INSFORGE_BOLETAS_API_KEY (proyecto InsForge Boletas).'
    );
  }

  return createAdminClient({ baseUrl, apiKey });
}

export function getInsforgeBoletasConfig(): {
  baseUrl: string;
  apiKey: string;
} | null {
  const baseUrl = process.env.INSFORGE_BOLETAS_URL?.trim();
  const apiKey = process.env.INSFORGE_BOLETAS_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}
