/**
 * 2026-10-09 - Correos de Beca SEP a la familia (papás con "recibir correo" en alumno_familiar):
 *   recibido    → se recibió el documento y está en revisión
 *   correccion  → Control Escolar pide otro documento (con el motivo)
 *   aplicada    → desglose del cálculo + constancia PDF + quién aplicó
 *   actualizada → Dirección General recalculó o ajustó la mensualidad (desglose + constancia nueva)
 *   pago        → pagó de menos o de más contra la mensualidad aplicada (lo envía Control Escolar)
 * En modo local el correo no sale: se guarda una vista previa en .local-sep/correos/.
 * BECAS_EMAIL_FORCE_TEST=1 manda todo a BECAS_EMAIL_TO en lugar de a las familias.
 * 2026-10-09 - Anti-spam: límites de frecuencia (limitesCorreo.ts), versión en texto plano, nombres en tipo
 *              título y encabezado de correo automático. "recibido" ya no se envía (se ve en pantalla).
 */
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { sendMail, type MailAttachment } from '@/lib/mailer';
import { esModoLocalSoloLectura } from '@/lib/modo-local';
import { buzonPruebaSep, correosSepSoloPrueba } from '@/lib/sep/activo';
import { pesos } from '@/lib/sep/core/dinero';
import { armarHojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { constanciaSepPdf, fechaLarga, folioSep, quienAplico } from '@/lib/sep/constancia';
import { correosFamilia } from '@/lib/sep/insforge/consultas';
import type { ResumenPagos } from '@/lib/sep/pagos';
import { dirDatosSep } from '@/lib/sep/repo';
import { motivoNoEnviarCorreo } from '@/lib/sep/limitesCorreo';
import type { ActorSep, EventoSep, SolicitudSep, TipoCorreoSep } from '@/lib/sep/tipos';

export type { TipoCorreoSep };

/** "ORTIZ RAMIREZ ANA ISABELLA" → "Ortiz Ramirez Ana Isabella" (conserva "de", "la", "del" en minúscula). */
export function nombrePropio(n: string): string {
  return n
    .toLocaleLowerCase('es-MX')
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && /^(de|del|la|las|los|y)$/.test(p) ? p : p.charAt(0).toLocaleUpperCase('es-MX') + p.slice(1)))
    .join(' ');
}

/** 2026-10-09 - Versión en texto plano del correo (los correos solo HTML puntúan peor en filtros de spam). */
export function textoPlano(html: string): string {
  return html
    .replace(/<(style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(td)>/gi, '\t')
    .replace(/<(br|\/p|\/tr|\/div|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]*\t[ \t]*/g, '  ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "is***@gmail.com": se guarda en el historial sin exponer el correo completo. */
const ocultar = (c: string) => c.replace(/^(.{2})[^@]*@/, '$1***@');

function marco(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#16213e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dce4f2;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b173a;color:#ffffff;padding:18px 24px">
<div style="font-size:11px;letter-spacing:1.2px">INSTITUTO WINSTON CHURCHILL</div>
<div style="font-size:20px;font-weight:bold;margin-top:4px">${esc(titulo)}</div></td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.55">${cuerpo}</td></tr>
<tr><td style="background:#eaf0fa;color:#5e6c84;padding:12px 24px;font-size:12px">Correo automático del Portal de Becas. Si tiene dudas, comuníquese con Control Escolar.</td></tr>
</table></td></tr></table></body></html>`;
}

const renglon = (etiqueta: string, valor: string, fuerte = false) =>
  `<tr><td style="padding:6px 0;color:#5e6c84">${esc(etiqueta)}</td><td style="padding:6px 0;text-align:right;${fuerte ? 'font-weight:bold;color:#0b173a;font-size:16px' : ''}">${valor}</td></tr>`;

function desglose(s: SolicitudSep): string {
  if (!s.calculo) return '';
  const hoja = armarHojaCalculo(s.calculo.entrada);
  const r = s.calculo.entrada.resultado;
  const mensual = s.ajusteManual?.monto ?? s.calculo.montoMensual;
  const meses = hoja.mesesPorPagar;
  const periodo = meses.length ? (meses.length === 1 ? meses[0] : `${meses[0]} a ${meses[meses.length - 1]}`) : '—';
  const beca = s.becaSustituida;
  const filas = [
    renglon('Colegiatura oficial', pesos(s.calculo.entrada.colegiaturaOficial)),
    beca ? renglon('Beca del colegio que tenía (se pierde)', `${esc(beca.clase ?? 'Beca')} ${beca.porcentaje} %`) : '',
    renglon(`Colegiatura con Beca SEP del ${s.porcentajeConfirmado ?? s.calculo.porcentajeSep} %`, pesos(r.colSep)),
    renglon(
      r.excedenteTotal >= 0 ? 'Saldo a su favor de lo ya pagado' : 'Saldo en contra de lo ya pagado',
      pesos(Math.abs(r.excedenteTotal))
    ),
    renglon('Meses por pagar', `${meses.length} (${esc(periodo)})`),
    renglon('Nueva mensualidad', pesos(mensual), true),
    hoja.saldoSobrante > 0 ? renglon('Saldo a favor al terminar el ciclo', pesos(hoja.saldoSobrante)) : '',
  ].join('');
  const explicacion =
    r.excedenteTotal < 0
      ? 'Los meses que ya pagó quedaron por debajo del precio con Beca SEP; esa diferencia se reparte en partes iguales en los meses que faltan.'
      : r.excedenteTotal > 0
        ? 'Lo que pagó de más en los meses anteriores se descuenta en partes iguales de los meses que faltan.'
        : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #dce4f2;border-bottom:1px solid #dce4f2;margin:12px 0">${filas}</table>
${explicacion ? `<p style="color:#5e6c84;font-size:13px">${explicacion}</p>` : ''}
${s.ajusteManual ? `<p style="color:#5e6c84;font-size:13px">Ajuste de Dirección General: ${esc(s.ajusteManual.motivo)}</p>` : ''}`;
}

function avisoBecaPerdida(s: SolicitudSep): string {
  if (!s.becaSustituida) return '';
  return `<p style="background:#fff7e6;border:1px solid #f5d48a;border-radius:8px;padding:10px 12px;font-size:13px">
La beca del colegio (${esc(s.becaSustituida.clase ?? 'beca')} ${s.becaSustituida.porcentaje} %) se sustituyó por la Beca SEP y <strong>no se renovará</strong> el próximo ciclo escolar. Si la quiere de nuevo, deberá solicitarla como solicitud nueva.</p>`;
}

function contenido(
  tipo: TipoCorreoSep,
  s: SolicitudSep,
  extra: { motivo?: string; pagos?: ResumenPagos; por?: ActorSep }
): { asunto: string; titulo: string; cuerpo: string } {
  // 2026-10-09 - Nombre en tipo título: los asuntos en MAYÚSCULAS suben la puntuación de spam.
  const nombre = nombrePropio(s.nombreAlumno);
  const alumno = `<strong>${esc(nombre)}</strong> (No. de control ${s.alumnoRef})`;
  const ciclo = getSchoolCycleLabel(s.ciclo);
  switch (tipo) {
    case 'recibido':
      return {
        asunto: `Beca SEP: recibimos el documento de ${nombre}`,
        titulo: 'Recibimos su documento de Beca SEP',
        cuerpo: `<p>Recibimos el documento de autorización de Beca SEP de ${alumno} para el ciclo ${esc(ciclo)}.</p>
<p>Control Escolar lo revisará y, al aplicar la beca, le enviaremos por este medio el desglose de su nueva mensualidad y la constancia.</p>`,
      };
    case 'correccion':
      return {
        asunto: `Beca SEP: falta corregir el documento de ${nombre}`,
        titulo: 'Necesitamos otro documento',
        cuerpo: `<p>Control Escolar revisó el documento de Beca SEP de ${alumno} y le pide lo siguiente:</p>
<p style="background:#eaf0fa;border-radius:8px;padding:10px 12px"><strong>${esc(extra.motivo ?? s.motivoCorreccion ?? '')}</strong></p>
<p>Entre al Portal de Becas → Beca SEP con el número de control y la contraseña del alumno para subir el documento correcto.</p>`,
      };
    case 'aplicada':
      return {
        asunto: `Beca SEP aplicada: ${nombre}`,
        titulo: 'Su Beca SEP fue aplicada',
        cuerpo: `<p>${esc(quienAplico(s.revisadoPor))} aplicó la Beca SEP del <strong>${s.porcentajeConfirmado} %</strong> a ${alumno} el ${esc(fechaLarga(s.aplicadaEn).replace(/\.$/, ''))}.</p>
${desglose(s)}
${avisoBecaPerdida(s)}
<p>Adjuntamos la constancia en PDF (folio ${esc(folioSep(s))}). El cambio en sus mensualidades se verá reflejado en Servicios Administrativos.</p>`,
      };
    case 'actualizada':
      return {
        asunto: `Beca SEP: se actualizó la mensualidad de ${nombre}`,
        titulo: 'Se actualizó su mensualidad',
        cuerpo: `<p>${esc(quienAplico(extra.por ?? 'sistemas'))} actualizó el cálculo de la Beca SEP de ${alumno}. Este es el desglose vigente:</p>
${desglose(s)}
<p>Adjuntamos la constancia actualizada (folio ${esc(folioSep(s))}).</p>`,
      };
    case 'pago': {
      const p = extra.pagos;
      const filas = (p?.conDiferencia ?? [])
        .map(
          (f) =>
            `<tr><td style="padding:6px 0">${esc(f.mes)}</td><td style="text-align:right">${pesos(f.esperado)}</td><td style="text-align:right">${pesos(f.pagadoNeto)}</td><td style="text-align:right;font-weight:bold;color:${f.estado === 'menos' ? '#b42318' : '#2e7d32'}">${f.estado === 'menos' ? 'Faltan' : 'De más'} ${pesos(Math.abs(f.diferencia ?? 0))}</td></tr>`
        )
        .join('');
      return {
        asunto: `Beca SEP: revisión de pagos de ${nombre}`,
        titulo: 'Revisión de sus pagos',
        cuerpo: `<p>Revisamos los pagos de colegiatura de ${alumno} desde que se aplicó la Beca SEP y encontramos diferencias contra la mensualidad que le corresponde (${pesos(s.ajusteManual?.monto ?? s.calculo?.montoMensual ?? null)}):</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin:12px 0;border-top:1px solid #dce4f2">
<tr style="color:#5e6c84"><td style="padding:6px 0">Mes</td><td style="text-align:right">Le corresponde</td><td style="text-align:right">Pagó (sin recargos)</td><td style="text-align:right">Diferencia</td></tr>${filas}</table>
${p && p.deMenos > 0 ? `<p>Queda pendiente un total de <strong>${pesos(p.deMenos)}</strong>.</p>` : ''}
${p && p.deMas > 0 ? `<p>Tiene <strong>${pesos(p.deMas)}</strong> pagados de más; Control Escolar le indicará cómo se aplicarán.</p>` : ''}
<p>Si ya lo aclaró con Servicios Administrativos, puede ignorar este aviso.</p>`,
      };
    }
  }
}

async function guardarVistaLocal(nombreBase: string, html: string, adjuntos: MailAttachment[], destino: string[]) {
  const dir = path.join(dirDatosSep(), 'correos');
  await fs.mkdir(dir, { recursive: true });
  const cabecera = `<!-- Para: ${destino.map(ocultar).join(', ') || '(sin correo registrado)'} -->\n`;
  await fs.writeFile(path.join(dir, `${nombreBase}.html`), cabecera + html);
  await fs.writeFile(path.join(dir, `${nombreBase}.txt`), textoPlano(html));
  for (const a of adjuntos) await fs.writeFile(path.join(dir, `${nombreBase}-${a.filename}`), a.content);
}

/**
 * Envía el correo y regresa el evento para el historial del trámite. Nunca lanza: si falla el envío o no
 * hay correo registrado, el trámite sigue y el historial lo dice.
 */
export async function correoFamiliaSep(
  tipo: TipoCorreoSep,
  s: SolicitudSep,
  extra: { motivo?: string; pagos?: ResumenPagos; por?: ActorSep; actor?: ActorSep } = {}
): Promise<EventoSep> {
  const accion: EventoSep['accion'] = tipo === 'pago' ? 'aviso_pago' : 'correo_familia';
  const evento = (detalle: string, enviado = false): EventoSep => ({
    fecha: new Date().toISOString(),
    actor: extra.actor ?? 'sistema',
    accion,
    detalle,
    correo: { tipo, enviado },
  });
  // 2026-10-09 - Límite de frecuencia: no saturar a la familia ni dañar la reputación del buzón.
  const noEnviar = motivoNoEnviarCorreo(tipo, s.historial);
  if (noEnviar) return evento(`Correo (${tipo}) no enviado: ${noEnviar}.`);
  try {
    const { asunto, titulo, cuerpo } = contenido(tipo, s, extra);
    const html = marco(titulo, cuerpo);
    const adjuntos: MailAttachment[] =
      (tipo === 'aplicada' || tipo === 'actualizada') && s.calculo
        ? [{ filename: `Constancia-Beca-SEP-${s.alumnoRef}.pdf`, content: await constanciaSepPdf(s), contentType: 'application/pdf' }]
        : [];
    // 2026-10-10 - Con el interruptor de Beca SEP apagado los correos van solo al buzón de prueba.
    const destino = correosSepSoloPrueba() ? [buzonPruebaSep()] : await correosFamilia(s.alumnoId);

    if (esModoLocalSoloLectura()) {
      const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${s.alumnoRef}-${tipo}`;
      await guardarVistaLocal(base, html, adjuntos, destino);
    }
    if (!destino.length) {
      return evento(`«${asunto}» no se envió: la familia no tiene correo registrado para avisos.`);
    }
    // 2026-10-09 - Texto plano + "Auto-Submitted" (RFC 3834: correo automático; evita respuestas automáticas en bucle).
    //              Reply-To opcional a un buzón real de Control Escolar (BECAS_SEP_REPLY_TO).
    await sendMail({
      to: destino,
      subject: asunto,
      html,
      text: textoPlano(html),
      headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
      replyTo: process.env.BECAS_SEP_REPLY_TO?.trim() || undefined,
      attachments: adjuntos,
    });
    const local = esModoLocalSoloLectura() ? ' (modo local: no salió, vista previa en .local-sep/correos)' : '';
    return evento(`«${asunto}» a ${destino.map(ocultar).join(', ')}${adjuntos.length ? ' con constancia PDF' : ''}${local}.`, true);
  } catch (e) {
    console.error('[sep] correo familia', tipo, e);
    return evento(`No se pudo enviar el correo (${tipo}) a la familia: ${e instanceof Error ? e.message : 'error'}.`);
  }
}