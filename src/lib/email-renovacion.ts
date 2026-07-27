/**
 * 2026-07-16 - HTML del correo de notificación de renovación (InsForge Email).
 * Sin adjuntos: solo enlaces de descarga firmados.
 */

export type DocLinkForEmail = {
  tipo: string;
  label: string;
  url: string;
};

export type EmailRenovacionData = {
  alumnoNombre: string;
  alumnoRef: string;
  nivelLabel: string;
  gradoGrupo: string;
  cicloLabel: string;
  becaClase: string;
  becaPorcentaje: number;
  documentos: DocLinkForEmail[];
};

// 2026-07-17 - Catálogo nuevo; labels legacy por si quedan filas viejas
const TIPO_LABELS: Record<string, string> = {
  acta_nacimiento: 'Acta de nacimiento',
  curp: 'CURP del alumno',
  curp_tutor: 'CURP del papá o mamá',
  constancia_no_adeudo: 'Constancia de no adeudo',
  carta_buena_conducta: 'Carta de buena conducta',
  boleta: 'Boleta SEP del ciclo escolar',
  comp_inscripcion: 'Comprobante(s) de pago de inscripción completa',
  ingresos: 'Comprobante(s) de ingresos de un mes (padre, madre y/o tutor)',
  domicilio: 'Comprobante de domicilio (teléfono, agua o luz)',
  boleta_interna: 'Última boleta interna',
};

export function labelDocumentoTipo(tipo: string): string {
  return TIPO_LABELS[tipo] || tipo;
}

/** Mapeo simple de códigos de nivel del maestro (si existen). */
export function labelNivel(nivel: number | null | undefined): string {
  if (nivel == null) return 'Sin nivel';
  const map: Record<number, string> = {
    1: 'Maternal',
    2: 'Kinder',
    3: 'Primaria',
    4: 'Secundaria',
  };
  return map[nivel] || `Nivel ${nivel}`;
}

/**
 * 2026-07-16 - Destinatario To según alumno_nivel (producción por defecto).
 * 2026-07-22 - Prueba explícita: BECAS_EMAIL_FORCE_TEST=1 → To sistemas3 / BECAS_EMAIL_TO.
 */
export function emailToByNivel(
  nivel: number | null | undefined
): string | null {
  // 2026-07-22 - Solo en pruebas locales; no usar en Vercel Production
  if (process.env.BECAS_EMAIL_FORCE_TEST === '1') {
    return (
      process.env.BECAS_EMAIL_TO?.trim() || 'sistemas3@winston93.edu.mx'
    );
  }

  if (nivel == null || !Number.isFinite(Number(nivel))) return null;
  const n = Number(nivel);
  if (n === 1 || n === 2) {
    return (
      process.env.BECAS_EMAIL_KINDER?.trim() ||
      'becas.kinder@winston93.edu.mx'
    );
  }
  if (n === 3) {
    return (
      process.env.BECAS_EMAIL_PRIMARIA?.trim() ||
      'becas.primaria@winston93.edu.mx'
    );
  }
  if (n === 4) {
    return (
      process.env.BECAS_EMAIL_SECUNDARIA?.trim() ||
      'becas.secundaria@winston93.edu.mx'
    );
  }
  return null;
}

/** 2026-07-24 - Copia oculta a desarrollo (override: BECAS_EMAIL_BCC). */
export function emailBccSistemas(): string {
  return (
    process.env.BECAS_EMAIL_BCC?.trim() || 'desarrollo@winston93.edu.mx'
  );
}

/**
 * 2026-07-17 - To + BCC; omite BCC si coincide con To (modo prueba).
 * 2026-07-24 - Producción: To por nivel + BCC desarrollo@.
 */
export function resolveBecasMailRecipients(
  nivel: number | null | undefined
): { to: string; bcc?: string } | null {
  const to = emailToByNivel(nivel);
  if (!to) return null;
  const bcc = emailBccSistemas();
  if (bcc.toLowerCase() === to.toLowerCase()) {
    return { to };
  }
  return { to, bcc };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildRenovacionEmailSubject(data: EmailRenovacionData): string {
  return `Renovación de beca — ${data.alumnoNombre} (${data.alumnoRef})`;
}

export function buildRenovacionEmailHtml(data: EmailRenovacionData): string {
  const docsList = data.documentos
    .map(
      (d) =>
        `<li style="margin:8px 0;"><a href="${escapeHtml(d.url)}" style="color:#0B173A;font-weight:600;">${escapeHtml(d.label)}</a></li>`
    )
    .join('');

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
              <h1 style="margin:6px 0 0;font-size:18px;font-weight:600;">Renovación de beca recibida</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#5E6C84;">
                Se registró una solicitud de renovación de beca. Los documentos van adjuntos a este correo; también puede descargarlos con los enlaces (válidos por 7 días).
              </p>
              <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;">
                <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${escapeHtml(data.alumnoNombre)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${escapeHtml(data.alumnoRef)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${escapeHtml(data.nivelLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${escapeHtml(data.gradoGrupo)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${escapeHtml(data.cicloLabel)}</td></tr>
                <tr><td style="color:#5E6C84;padding:4px 0;">Beca</td><td>${escapeHtml(data.becaClase)} (${data.becaPorcentaje}%)</td></tr>
              </table>
              <h2 style="margin:24px 0 8px;font-size:15px;color:#0B173A;">Documentos</h2>
              <ul style="margin:0;padding-left:18px;font-size:14px;">
                ${docsList}
              </ul>
              <p style="margin:24px 0 0;font-size:12px;color:#9AA6B2;line-height:1.4;">
                Este correo se generó automáticamente desde el Portal de Renovación de Becas.
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
