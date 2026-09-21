/**
 * 2026-08-13 - Cliente InsForge para promedios de boletas (solo servidor).
 * 2026-09-21 - Boletas viven en Winston Servicios (g4ta4bfg); NANO 5u3i4tmc eliminado.
 * Hosting MySQL sale de servicio; promedios de renovación viven aquí.
 */
import { createAdminClient } from '@insforge/sdk';

const NANO_BOLETAS_HOST = '5u3i4tmc';

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** True si la URL apunta al NANO Boletas ya eliminado. */
export function isInsforgeBoletasNanoEliminado(url: string | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes(NANO_BOLETAS_HOST);
}

/**
 * Resuelve credenciales para `promedio_ciclo` / `boleta_*`.
 * Preferencia: Winston (`INSFORGE_*`). `INSFORGE_BOLETAS_*` solo si no es el NANO muerto.
 */
export function resolveInsforgeBoletasConfig(): {
  baseUrl: string;
  apiKey: string;
} | null {
  const boletasUrl = trimEnv('INSFORGE_BOLETAS_URL');
  const boletasKey = trimEnv('INSFORGE_BOLETAS_API_KEY');
  const winstonUrl =
    trimEnv('INSFORGE_URL') ?? trimEnv('NEXT_PUBLIC_INSFORGE_URL');
  const winstonKey = trimEnv('INSFORGE_API_KEY');

  if (boletasUrl && boletasKey && !isInsforgeBoletasNanoEliminado(boletasUrl)) {
    return { baseUrl: boletasUrl, apiKey: boletasKey };
  }

  if (winstonUrl && winstonKey) {
    return { baseUrl: winstonUrl, apiKey: winstonKey };
  }

  return null;
}

export function getInsforgeBoletasAdmin() {
  const cfg = resolveInsforgeBoletasConfig();
  if (!cfg) {
    throw new Error(
      'Faltan credenciales InsForge para boletas. Configura INSFORGE_URL/INSFORGE_API_KEY (Winston Servicios) o INSFORGE_BOLETAS_*.'
    );
  }
  return createAdminClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
}

export function getInsforgeBoletasConfig(): {
  baseUrl: string;
  apiKey: string;
} | null {
  return resolveInsforgeBoletasConfig();
}
