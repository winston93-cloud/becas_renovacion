/**
 * Correo institucional: portal abierto post-cierre para corregir documentos.
 */
import { portalBecasIngresoUrl } from '@/lib/email-acceso-autorizado';
import type { ExcepcionDocIncorrecto } from '@/lib/excepcion-post-cierre-data';

export type EmailExcepcionPostCierreData = {
  alumnoNombre: string;
  alumnoRef: string;
  nivelLabel: string;
  gradoGrupo: string;
  cicloLabel: string;
  docsIncorrectos: ExcepcionDocIncorrecto[];
  portalUrl: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapEmail(title: string, bodyInner: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#16213E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #DCE4F2;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0B173A;color:#ffffff;padding:20px 24px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">Instituto Winston Churchill</p>
              <h1 style="margin:6px 0 0;font-size:18px;font-weight:600;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${bodyInner}
              <p style="margin:24px 0 0;font-size:12px;color:#9AA6B2;line-height:1.4;">
                Este correo se generó automáticamente desde el Portal de Becas.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildExcepcionPostCierreEmailSubject(
  data: EmailExcepcionPostCierreData
): string {
  return `Renovación de beca — puede corregir documentos (${data.alumnoRef})`;
}

export function buildExcepcionPostCierreEmailHtml(
  data: EmailExcepcionPostCierreData
): string {
  const portal = escapeHtml(data.portalUrl);
  const docsHtml = data.docsIncorrectos
    .map(
      (d) => `
        <li style="margin:0 0 10px;">
          <strong>${escapeHtml(d.label)}</strong>
          ${
            d.nota
              ? `<br /><span style="color:#9A3412;">${escapeHtml(d.nota)}</span>`
              : ''
          }
        </li>`
    )
    .join('');

  return wrapEmail(
    'Portal abierto para corregir documentos',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
                le informa que, aunque concluyó el periodo general de renovación de beca,
                <strong style="color:#16213E;">su expediente tiene documento(s) marcado(s) como incorrecto(s)</strong>.
                Por ello, el Portal de Becas le permite entrar únicamente para subir nuevamente
                el (los) archivo(s) indicado(s), de forma correcta.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;margin:0 0 16px;">
                <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${escapeHtml(data.alumnoNombre)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${escapeHtml(data.alumnoRef)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${escapeHtml(data.nivelLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${escapeHtml(data.gradoGrupo)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${escapeHtml(data.cicloLabel)}</td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#16213E;">
                Documento(s) por corregir
              </p>
              <div style="margin:0 0 16px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;font-size:14px;line-height:1.5;color:#9A3412;">
                <ul style="margin:0;padding-left:18px;">${docsHtml}</ul>
              </div>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Ingrese con el <strong style="color:#16213E;">número de control</strong> y la
                <strong style="color:#16213E;">contraseña escolar</strong> del alumno.
                En <strong style="color:#16213E;">Carga de documentos</strong> podrá reemplazar
                solo los archivos marcados como incorrectos. Los documentos ya verificados
                no deben modificarse. No es necesario volver a llenar el formulario completo.
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                En la pantalla de inicio elija <strong style="color:#16213E;">Renovación</strong>.
                El enlace ya deja seleccionado su trámite y número de control;
                solo escriba la contraseña del alumno.
              </p>
              <p style="margin:22px 0 12px;text-align:center;">
                <a href="${portal}" style="display:inline-block;background:#0B173A;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
                  Ir al Portal de Becas
                </a>
              </p>
              <p style="margin:0;padding:12px 14px;background:#EAF0FA;border-radius:8px;font-size:13px;line-height:1.5;color:#0B173A;">
                Cuando haya subido correctamente todos los documentos indicados, el acceso
                especial concluirá automáticamente. Para dudas, acuda al área de becas del Instituto.
              </p>`
  );
}

export function emailDataFromFamilia(
  f: {
    alumno_ref: string;
    nombre: string;
    nivel_label: string;
    grado_grupo: string;
    docs_incorrectos: ExcepcionDocIncorrecto[];
  },
  cicloLabel: string
): EmailExcepcionPostCierreData {
  return {
    alumnoNombre: f.nombre,
    alumnoRef: f.alumno_ref,
    nivelLabel: f.nivel_label,
    gradoGrupo: f.grado_grupo,
    cicloLabel,
    docsIncorrectos: f.docs_incorrectos,
    portalUrl: portalBecasIngresoUrl({
      flujo: 'renovacion',
      alumnoRef: f.alumno_ref,
    }),
  };
}

/** Copia operativa solicitada por sistemas. */
export const EXCEPCION_POST_CIERRE_BCC =
  'sistemas.desarrollo@winston93.edu.mx';
