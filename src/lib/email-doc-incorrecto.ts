/**
 * Aviso a la familia: un documento del expediente fue marcado incorrecto.
 */

export type EmailDocIncorrectoData = {
  alumnoNombre: string;
  alumnoRef: string;
  nivelLabel: string;
  gradoGrupo: string;
  cicloLabel: string;
  documentoLabel: string;
  motivo: string;
  portalUrl: string;
  flujo: 'renovacion' | 'solicitud';
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

export function buildDocIncorrectoEmailSubject(
  data: EmailDocIncorrectoData
): string {
  return `Documento por corregir — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export type EmailDocFaltanteData = {
  alumnoNombre: string;
  alumnoRef: string;
  nivelLabel: string;
  gradoGrupo: string;
  cicloLabel: string;
  documentosLabels: string[];
  portalUrl: string;
  flujo: 'renovacion' | 'solicitud';
};

export function buildDocFaltanteEmailSubject(
  data: EmailDocFaltanteData
): string {
  return `Documento pendiente — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildDocFaltanteEmailHtml(data: EmailDocFaltanteData): string {
  const portal = escapeHtml(data.portalUrl);
  const tramite =
    data.flujo === 'renovacion' ? 'renovación de beca' : 'solicitud de beca';
  const lista = data.documentosLabels
    .map(
      (label) =>
        `<li style="margin:0 0 6px;"><strong>${escapeHtml(label)}</strong></li>`
    )
    .join('');
  return wrapEmail(
    'Documento pendiente de entregar',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
                le informa que, en la revisión de la <strong style="color:#16213E;">${escapeHtml(tramite)}</strong>
                del alumno, hace falta uno o más documentos para continuar.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;margin:0 0 16px;">
                <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${escapeHtml(data.alumnoNombre)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${escapeHtml(data.alumnoRef)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${escapeHtml(data.nivelLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${escapeHtml(data.gradoGrupo)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${escapeHtml(data.cicloLabel)}</td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#16213E;">
                Documento(s) por subir
              </p>
              <div style="margin:0 0 16px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;font-size:14px;line-height:1.5;color:#9A3412;">
                <ul style="margin:0;padding-left:18px;">${lista}</ul>
              </div>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Ingrese al Portal de Becas con el número de control y la contraseña escolar del alumno.
                En <strong style="color:#16213E;">Carga de documentos</strong> verá los archivos ya entregados
                y podrá subir únicamente el (o los) que aparecen como pendientes.
                No es necesario volver a llenar el formulario completo.
              </p>
              ${
                data.flujo === 'solicitud'
                  ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                En la pantalla de inicio elija <strong style="color:#16213E;">Solicitud nueva</strong>
                (no Renovación). El enlace ya deja seleccionado su trámite y número de control;
                solo escriba la contraseña del alumno.
              </p>`
                  : `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                En la pantalla de inicio elija <strong style="color:#16213E;">Renovación</strong>.
                El enlace ya deja seleccionado su trámite y número de control;
                solo escriba la contraseña del alumno.
              </p>`
              }
              <p style="margin:22px 0 12px;text-align:center;">
                <a href="${portal}" style="display:inline-block;background:#0B173A;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
                  Ir al Portal de Becas
                </a>
              </p>`
  );
}

export function buildDocIncorrectoEmailHtml(
  data: EmailDocIncorrectoData
): string {
  const portal = escapeHtml(data.portalUrl);
  const tramite =
    data.flujo === 'renovacion' ? 'renovación de beca' : 'solicitud de beca';
  return wrapEmail(
    'Documento marcado como incorrecto',
    `
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
                le informa que, en la revisión de la <strong style="color:#16213E;">${escapeHtml(tramite)}</strong>
                del alumno, se detectó un documento que debe corregirse.
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;margin:0 0 16px;">
                <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${escapeHtml(data.alumnoNombre)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${escapeHtml(data.alumnoRef)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${escapeHtml(data.nivelLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${escapeHtml(data.gradoGrupo)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${escapeHtml(data.cicloLabel)}</td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#16213E;">
                Documento a corregir
              </p>
              <p style="margin:0 0 12px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;font-size:14px;line-height:1.5;color:#9A3412;">
                <strong>${escapeHtml(data.documentoLabel)}</strong><br/>
                <span style="color:#7C2D12;">Motivo: ${escapeHtml(data.motivo)}</span>
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                Ingrese al Portal de Becas con el número de control y la contraseña escolar del alumno.
                En <strong style="color:#16213E;">Carga de documentos</strong> verá los documentos ya verificados
                y podrá subir únicamente el (o los) documento(s) marcado(s) como incorrecto(s).
                No es necesario volver a llenar el formulario completo.
              </p>
              ${
                data.flujo === 'solicitud'
                  ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                En la pantalla de inicio elija <strong style="color:#16213E;">Solicitud nueva</strong>
                (no Renovación). El enlace ya deja seleccionado su trámite y número de control;
                solo escriba la contraseña del alumno.
              </p>`
                  : `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
                En la pantalla de inicio elija <strong style="color:#16213E;">Renovación</strong>.
                El enlace ya deja seleccionado su trámite y número de control;
                solo escriba la contraseña del alumno.
              </p>`
              }
              <p style="margin:22px 0 12px;text-align:center;">
                <a href="${portal}" style="display:inline-block;background:#0B173A;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
                  Ir al Portal de Becas
                </a>
              </p>`
  );
}
