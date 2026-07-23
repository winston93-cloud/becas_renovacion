/**
 * 2026-07-16 - Cliente InsForge solo servidor (API key de servicio).
 * Nunca importar este módulo desde componentes cliente.
 */
import { createAdminClient } from '@insforge/sdk';

export function getInsforgeAdmin() {
  const baseUrl = process.env.INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('Faltan INSFORGE_URL o INSFORGE_API_KEY en el entorno del servidor.');
  }

  return createAdminClient({ baseUrl, apiKey });
}
