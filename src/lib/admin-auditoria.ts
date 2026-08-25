/**
 * Bitácora de acciones del panel Control Escolar.
 * Guarda rol (cuenta de nivel), fecha/hora, IP y detalle del movimiento.
 */
import { getInsforgeAdmin } from '@/lib/insforge-server';
import type { AdminAuth } from '@/lib/admin-auth';

export type AuditoriaAccion =
  | 'login'
  | 'logout'
  | 'renovacion.verificar'
  | 'renovacion.quitar_verificacion'
  | 'renovacion.autorizar'
  | 'renovacion.quitar_autorizacion'
  | 'renovacion.cambiar_beca'
  | 'solicitud.verificar'
  | 'solicitud.quitar_verificacion'
  | 'solicitud.autorizar'
  | 'solicitud.quitar_autorizacion'
  | 'solicitud.cambiar_beca'
  | 'acceso.autorizar'
  | 'acceso.revocar'
  | 'documento.marcar_ok'
  | 'documento.marcar_incorrecto'
  | 'documento.quitar_rechazo'
  | 'documento.avisar_faltante'
  | 'renovacion.rechazo_beca'
  | 'solicitud.rechazo_beca';

export type AuditoriaEntidad =
  | 'sesion'
  | 'renovacion'
  | 'solicitud'
  | 'acceso'
  | 'documento';

export type AuditoriaEntry = {
  actor_role: string;
  actor_label: string;
  accion: AuditoriaAccion | string;
  entidad: AuditoriaEntidad | string;
  entidad_id?: string | null;
  alumno_id?: number | null;
  alumno_ref?: string | null;
  alumno_nombre?: string | null;
  alumno_nivel?: number | null;
  detalle?: Record<string, unknown>;
  ip?: string | null;
  user_agent?: string | null;
};

export function clientMetaFromRequest(request: Request): {
  ip: string | null;
  user_agent: string | null;
} {
  const xf =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '';
  const ip = xf.split(',')[0]?.trim() || null;
  const ua = request.headers.get('user-agent');
  return {
    ip,
    user_agent: ua ? ua.slice(0, 280) : null,
  };
}

/** Inserta un evento; nunca tumba la acción principal si falla el log. */
export async function registrarAuditoria(
  admin: AdminAuth,
  entry: Omit<AuditoriaEntry, 'actor_role' | 'actor_label'> & {
    actor_role?: string;
    actor_label?: string;
  }
): Promise<void> {
  try {
    const db = getInsforgeAdmin();
    const row = {
      actor_role: entry.actor_role ?? admin.role,
      actor_label: entry.actor_label ?? admin.label,
      accion: entry.accion,
      entidad: entry.entidad,
      entidad_id: entry.entidad_id ?? null,
      alumno_id: entry.alumno_id ?? null,
      alumno_ref: entry.alumno_ref != null ? String(entry.alumno_ref) : null,
      alumno_nombre: entry.alumno_nombre ?? null,
      alumno_nivel:
        entry.alumno_nivel != null && Number.isFinite(Number(entry.alumno_nivel))
          ? Number(entry.alumno_nivel)
          : null,
      detalle: entry.detalle ?? {},
      ip: entry.ip ?? null,
      user_agent: entry.user_agent ?? null,
    };
    const { error } = await db.database
      .from('becas_admin_auditoria')
      .insert([row]);
    if (error) {
      console.error('[auditoria]', error.message);
    }
  } catch (err) {
    console.error('[auditoria]', err);
  }
}

export function etiquetaAccionAuditoria(accion: string): string {
  const map: Record<string, string> = {
    login: 'Inicio de sesión',
    logout: 'Cierre de sesión',
    'renovacion.verificar': 'Verificó renovación',
    'renovacion.quitar_verificacion': 'Quitó verificación (renovación)',
    'renovacion.autorizar': 'Autorizó beca (renovación)',
    'renovacion.quitar_autorizacion': 'Quitó autorización (renovación)',
    'renovacion.cambiar_beca': 'Cambió tipo/porcentaje (renovación)',
    'solicitud.verificar': 'Verificó solicitud nueva',
    'solicitud.quitar_verificacion': 'Quitó verificación (solicitud)',
    'solicitud.autorizar': 'Autorizó beca (solicitud)',
    'solicitud.quitar_autorizacion': 'Quitó autorización (solicitud)',
    'solicitud.cambiar_beca': 'Cambió tipo/porcentaje (solicitud)',
    'acceso.autorizar': 'Autorizó acceso a solicitud nueva',
    'acceso.revocar': 'Revocó acceso a solicitud nueva',
    'documento.marcar_ok': 'Documento marcado OK',
    'documento.marcar_incorrecto': 'Documento marcado incorrecto',
    'documento.quitar_rechazo': 'Quitó rechazo de documento',
    'documento.avisar_faltante': 'Avisó documento faltante a padres',
  };
  return map[accion] || accion;
}
