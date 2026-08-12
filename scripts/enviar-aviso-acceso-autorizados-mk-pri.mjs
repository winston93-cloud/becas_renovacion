/**
 * One-shot: avisar a papás de MK/Primaria ya autorizados (antes del correo automático).
 * Uso: node --env-file=.env.local scripts/enviar-aviso-acceso-autorizados-mk-pri.mjs
 *      DRY_RUN=1 node --env-file=.env.local scripts/enviar-aviso-acceso-autorizados-mk-pri.mjs
 */
import nodemailer from 'nodemailer';

const DRY = process.env.DRY_RUN === '1';
const BASE = (process.env.INSFORGE_URL || '').replace(/\/$/, '');
const KEY = process.env.INSFORGE_API_KEY || '';
const PORTAL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BECAS_PORTAL_URL ||
  'https://becas-renovacion.vercel.app'
).replace(/\/$/, '');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cicloLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const startYear =
    month > 7 || (month === 7 && day >= 10) ? year : year - 1;
  const c = startYear - 2003;
  const start = 2003 + c;
  return `${start} - ${start + 1}`;
}

function labelNivel(n) {
  return ({ 1: 'Maternal', 2: 'Kinder', 3: 'Primaria', 4: 'Secundaria' }[n] ||
    `Nivel ${n}`);
}

function labelGrupo(g) {
  const n = Number(g);
  if (!Number.isFinite(n) || n === 0) return n === 0 ? 'sin grupo asignado' : '—';
  return ({ 1: 'A', 2: 'B', 3: 'C' }[n] || '—');
}

function buildHtml(data) {
  const portal = esc(data.portalUrl);
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#16213E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #DCE4F2;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0B173A;color:#ffffff;padding:20px 24px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">Instituto Winston Churchill</p>
          <h1 style="margin:6px 0 0;font-size:18px;font-weight:600;">Acceso autorizado al Portal de Becas</h1>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
            Por medio del presente, el <strong style="color:#16213E;">Instituto Winston Churchill</strong>
            le informa de manera oficial que su solicitud de acceso al Portal de Becas
            ha sido <strong style="color:#1F6B4A;">autorizada</strong>.
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#5E6C84;">
            Ya puede ingresar al portal con el número de control y la contraseña escolar
            del alumno para completar el formulario de <strong style="color:#16213E;">solicitud de beca por primera vez</strong>
            correspondiente al ciclo ${esc(data.cicloLabel)}.
          </p>
          <table role="presentation" width="100%" style="font-size:14px;line-height:1.6;">
            <tr><td style="color:#5E6C84;padding:4px 0;width:140px;">Alumno</td><td style="font-weight:600;">${esc(data.alumnoNombre)}</td></tr>
            <tr><td style="color:#5E6C84;padding:4px 0;">No. Control</td><td>${esc(data.alumnoRef)}</td></tr>
            <tr><td style="color:#5E6C84;padding:4px 0;">Nivel</td><td>${esc(data.nivelLabel)}</td></tr>
            <tr><td style="color:#5E6C84;padding:4px 0;">Grado / Grupo</td><td>${esc(data.gradoGrupo)}</td></tr>
            <tr><td style="color:#5E6C84;padding:4px 0;">Ciclo</td><td>${esc(data.cicloLabel)}</td></tr>
          </table>
          <p style="margin:22px 0 12px;text-align:center;">
            <a href="${portal}" style="display:inline-block;background:#0B173A;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
              Ingresar al Portal de Becas
            </a>
          </p>
          <p style="margin:0;padding:12px 14px;background:#EAF0FA;border-radius:8px;font-size:13px;line-height:1.5;color:#0B173A;">
            Conserve este correo como comprobante de autorización. Si no solicitó este acceso,
            comuníquese con Control Escolar / área de becas del Instituto.
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#9AA6B2;line-height:1.4;">
            Este correo se generó automáticamente desde el Portal de Becas.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  if (!BASE || !KEY) throw new Error('Faltan INSFORGE_URL / INSFORGE_API_KEY');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const fromName = process.env.SMTP_FROM_NAME || 'Instituto Winston Churchill';
  if (!user || !pass) throw new Error('Faltan SMTP_USER / SMTP_PASS');

  const rows = [];
  for (const nivel of [1, 2, 3]) {
    const chunk = await apiGet(
      `/api/database/records/alumno?alumno_nivel=eq.${nivel}&alumno_permiso_solicitud_beca=eq.1&alumno_status=neq.0&select=alumno_id,alumno_ref,alumno_app,alumno_apm,alumno_nombre,alumno_nivel,alumno_grado,alumno_grupo&limit=500`
    );
    rows.push(...(chunk || []));
  }
  const alumnos = rows.filter(
    (r) => ![29901, 29902].includes(Number(r.alumno_ref))
  );
  console.log(`Autorizados MK/PRI a notificar: ${alumnos.length}`);

  const ids = alumnos.map((a) => Number(a.alumno_id));
  const emailsMap = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const inlist = `(${slice.join(',')})`;
    const fam = await apiGet(
      `/api/database/records/alumno_familiar?alumno_id=in.${inlist}&tutor_id=in.(1,2)&select=alumno_id,familiar_email&limit=2000`
    );
    for (const f of fam || []) {
      const em = String(f.familiar_email || '')
        .trim()
        .toLowerCase();
      if (!em.includes('@')) continue;
      const aid = Number(f.alumno_id);
      const set = emailsMap.get(aid) || new Set();
      set.add(em);
      emailsMap.set(aid, set);
    }
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user, pass },
  });

  const ciclo = cicloLabel();
  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (const a of alumnos) {
    const nombre = `${a.alumno_app || ''} ${a.alumno_apm || ''} ${a.alumno_nombre || ''}`.trim();
    const to = [...(emailsMap.get(Number(a.alumno_id)) || [])];
    const line = `${a.alumno_ref} | ${nombre} | ${labelNivel(Number(a.alumno_nivel))} | to=${to.join(',') || '(sin correo)'}`;
    if (to.length === 0) {
      console.log(`SKIP ${line}`);
      skip += 1;
      continue;
    }
    const data = {
      alumnoNombre: nombre || 'Sin nombre',
      alumnoRef: String(a.alumno_ref),
      nivelLabel: labelNivel(Number(a.alumno_nivel)),
      gradoGrupo: `${a.alumno_grado ?? '—'} / ${labelGrupo(a.alumno_grupo)}`,
      cicloLabel: ciclo,
      portalUrl: PORTAL,
    };
    const subject = `Acceso autorizado al Portal de Becas — ${data.alumnoNombre} (${data.alumnoRef})`;
    if (DRY) {
      console.log(`DRY ${line}`);
      ok += 1;
      continue;
    }
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${from}>`,
        to,
        replyTo: process.env.BECAS_EMAIL_REPLY_TO || process.env.BECAS_EMAIL_TO || from,
        subject,
        html: buildHtml(data),
      });
      console.log(`OK  ${line} | id=${info.messageId || ''}`);
      ok += 1;
    } catch (e) {
      console.log(`ERR ${line} | ${e.message}`);
      fail += 1;
    }
  }

  console.log(`\nResumen: ok=${ok} fail=${fail} skip=${skip} dry=${DRY}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
