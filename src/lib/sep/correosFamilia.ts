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
import { NOMBRE_CONCEPTO } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { armarHojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { periodoMeses, resumenFamiliaSep } from '@/lib/sep/core/resumenFamilia';
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

// 2026-10-12 - Identidad de winston93.edu.mx: logo, azul #013BDF / #012A9E y acento #E3FB07.
const LOGO_WINSTON_URL = 'https://winston93.edu.mx/images/logos/logo_winston.png';
const AZUL = '#013BDF';
const AZUL_OSCURO = '#012A9E';
const ACENTO = '#E3FB07';
const GRIS = '#5e6c84';
const BORDE = '#dce4f2';

function marco(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F7F8FC;font-family:Arial,Helvetica,sans-serif;color:#16213e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FC;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${BORDE};border-radius:12px;overflow:hidden">
<tr><td style="background:#ffffff;padding:18px 24px 14px"><a href="https://winston93.edu.mx"><img src="${LOGO_WINSTON_URL}" width="160" alt="Winston" style="display:block;border:0;height:auto;width:160px"></a></td></tr>
<tr><td style="background:${AZUL};color:#ffffff;padding:16px 24px">
<div style="font-size:11px;letter-spacing:1.2px">INSTITUTO WINSTON CHURCHILL · PORTAL DE BECAS</div>
<div style="font-size:20px;font-weight:bold;margin-top:4px">${esc(titulo)}</div></td></tr>
<tr><td style="background:${ACENTO};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:24px;font-size:14px;line-height:1.55">${cuerpo}</td></tr>
<tr><td style="background:${AZUL_OSCURO};color:#dbe4ff;padding:14px 24px;font-size:12px">Correo automático del Portal de Becas. Si tiene dudas, comuníquese con Control Escolar.<br><a href="https://winston93.edu.mx" style="color:${ACENTO};text-decoration:none">winston93.edu.mx</a></td></tr>
</table></td></tr></table></body></html>`;
}

const renglon = (etiqueta: string, valor: string, fuerte = false) =>
  `<tr><td style="padding:6px 0;color:${GRIS}">${esc(etiqueta)}</td><td style="padding:6px 0;text-align:right;${fuerte ? `font-weight:bold;color:${AZUL_OSCURO};font-size:16px` : ''}">${valor}</td></tr>`;

/** Paso numerado del resumen (círculo azul + título + contenido). */
const paso = (n: number, titulo: string, cuerpo: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0"><tr>
<td width="30" valign="top"><div style="width:26px;height:26px;border-radius:13px;background:${AZUL};color:#ffffff;text-align:center;line-height:26px;font-weight:bold;font-size:13px">${n}</div></td>
<td style="padding-left:10px"><div style="font-weight:bold;color:${AZUL_OSCURO};font-size:15px;margin:3px 0 6px">${esc(titulo)}</div>${cuerpo}</td></tr></table>`;

const tabla = (encabezados: string[], filas: string[][], pie?: string[]) => {
  const celda = (v: string, i: number, estilo = '') =>
    `<td style="padding:7px 6px;${i > 0 ? 'text-align:right;' : ''}border-bottom:1px solid ${BORDE};${estilo}">${v}</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-top:1px solid ${BORDE}">
<tr>${encabezados.map((h, i) => celda(esc(h), i, `color:${GRIS};font-size:12px`)).join('')}</tr>
${filas.map((f) => `<tr>${f.map((v, i) => celda(v, i)).join('')}</tr>`).join('')}
${pie ? `<tr>${pie.map((v, i) => celda(v, i, `font-weight:bold;background:#F7F8FC`)).join('')}</tr>` : ''}</table>`;
};

const diferenciaTexto = (d: number) =>
  d > 0
    ? `<span style="color:#2e7d32;font-weight:bold">${pesos(d)} a su favor</span>`
    : d < 0
      ? `<span style="color:#b42318;font-weight:bold">${pesos(-d)} en contra</span>`
      : '—';

/**
 * 2026-10-12 - Cálculo resumido en tres pasos para la familia: precios con Beca SEP, lo que ya pagó
 * (inscripción incluida) y cómo se reparte el saldo. Mismos números que la constancia PDF.
 */
function desglose(s: SolicitudSep): string {
  if (!s.calculo) return '';
  const hoja = armarHojaCalculo(s.calculo.entrada);
  const f = resumenFamiliaSep(s.calculo.entrada, hoja.mesesPorPagar, s.ajusteManual?.monto ?? null);
  const pct = s.porcentajeConfirmado ?? f.porcentajeSep;
  const n = f.mesesPorPagar.length;
  const periodo = periodoMeses(f.mesesPorPagar);
  const nota = (t: string) => `<p style="color:${GRIS};font-size:12px;margin:8px 0 0">${t}</p>`;

  const paso1 = paso(
    1,
    `Sus precios con Beca SEP del ${pct} %`,
    tabla(
      ['Concepto', 'Precio normal', `Con Beca SEP ${pct} %`],
      [
        ['Inscripción', pesos(f.inscripcionOficial), `<strong>${pesos(f.inscripcionConSep)}</strong>`],
        [`Colegiatura mensual (plan de ${s.calculo.entrada.planMeses} meses)`, pesos(f.colegiaturaOficial), `<strong>${pesos(f.colegiaturaConSep)}</strong>`],
      ]
    )
  );

  const paso2 = paso(
    2,
    'Lo que ya pagó, comparado con el precio con Beca SEP',
    f.pagados.length
      ? tabla(
          ['Concepto', 'Pagó', 'Con Beca SEP', 'Diferencia'],
          f.pagados.map((p) => [esc(p.concepto), pesos(p.pago), pesos(p.conSep), diferenciaTexto(p.diferencia)]),
          [f.saldo >= 0 ? 'Saldo a su favor' : 'Saldo en contra', '', '', pesos(Math.abs(f.saldo))]
        ) +
          (s.becaSustituida
            ? nota(`Lo que pagó con su beca del colegio (${esc(s.becaSustituida.clase ?? 'beca')} ${s.becaSustituida.porcentaje} %) se compara contra el precio con Beca SEP. Los recargos no cuentan.`)
            : nota('Los recargos no cuentan en esta comparación.'))
      : `<p style="margin:0">Todavía no había pagado inscripción ni colegiaturas del ciclo, así que no hay saldo que repartir.</p>`
  );

  const paso3 = f.anioCompleto
    ? paso(
        3,
        'Su saldo cubre el resto del ciclo',
        `<p style="margin:0">Su saldo a favor (${pesos(f.saldo)}) alcanza para los ${n} meses que faltan (${esc(periodo)}): ${pesos(f.colegiaturaConSep)} × ${n} = ${pesos(f.colegiaturaConSep * n)}. No paga colegiatura el resto del ciclo${f.saldoAlFinal > 0 ? ` y le quedan <strong>${pesos(f.saldoAlFinal)}</strong> a favor` : ''}.</p>`
      )
    : f.porMes != null && f.porMes !== 0
      ? paso(
          3,
          `Ese saldo se reparte en los ${n} meses que faltan`,
          `<p style="margin:0">${pesos(Math.abs(f.saldo))} ÷ ${n} meses (${esc(periodo)}) = <strong>${pesos(Math.abs(f.porMes))} ${f.porMes > 0 ? 'menos' : 'más'}</strong> cada mes.</p>
<p style="margin:6px 0 0">${pesos(f.colegiaturaConSep)} ${f.porMes > 0 ? '−' : '+'} ${pesos(Math.abs(f.porMes))} = <strong>${pesos(f.mensualCalculada)}</strong></p>${
            f.topada ? nota('La mensualidad no puede ser mayor que la colegiatura normal; se cobra la colegiatura normal.') : ''
          }`
        )
      : paso(3, 'Sin saldo que repartir', `<p style="margin:0">Paga el precio con Beca SEP en los ${n} meses que faltan (${esc(periodo)}).</p>`);

  const resultado = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 6px;background:${AZUL};border-radius:10px"><tr><td style="padding:16px 18px;color:#ffffff">
<div style="font-size:12px;letter-spacing:1px">SU NUEVA MENSUALIDAD</div>
<div style="font-size:26px;font-weight:bold;margin-top:2px">${f.anioCompleto ? pesos(0) : pesos(f.mensual)}</div>
<div style="font-size:13px;margin-top:2px">${n} ${n === 1 ? 'mes' : 'meses'}: ${esc(periodo)}</div></td>
<td width="6" style="background:${ACENTO};border-radius:0 10px 10px 0">&nbsp;</td></tr></table>`;

  return `${paso1}${paso2}${paso3}${resultado}${
    s.ajusteManual ? nota(`Dirección General ajustó la mensualidad a ${pesos(s.ajusteManual.monto)}: ${esc(s.ajusteManual.motivo)}`) : ''
  }`;
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
    // 2026-10-12 - Dirección General autorizó regresar a la beca del colegio (o a la colegiatura sin beca).
    case 'revertida': {
      const c = s.reversion?.calculo;
      const beca = c && c.porcentajeBeca > 0 ? `su beca ${esc(c.claseBeca ?? 'del colegio')} del ${c.porcentajeBeca} %` : 'la colegiatura sin beca';
      const meses = c?.porPagar.map((x) => NOMBRE_CONCEPTO[x] ?? x) ?? [];
      const periodo = meses.length ? (meses.length === 1 ? meses[0] : `${meses[0]} a ${meses[meses.length - 1]}`) : '—';
      const filas = c
        ? [
            renglon('Precio con ' + (c.porcentajeBeca > 0 ? `beca del ${c.porcentajeBeca} %` : 'colegiatura completa'), pesos(c.precioConBeca)),
            renglon(c.excedente >= 0 ? 'Saldo a su favor de lo ya pagado' : 'Saldo en contra de lo ya pagado', pesos(Math.abs(c.excedente))),
            renglon('Meses por pagar', `${meses.length} (${esc(periodo)})`),
            renglon('Nueva mensualidad', pesos(c.mensual), true),
            c.saldoFavor > 0 ? renglon('Saldo a favor al terminar el ciclo', pesos(c.saldoFavor)) : '',
          ].join('')
        : '';
      return {
        asunto: `Beca SEP: regresa a su beca del colegio, ${nombre}`,
        titulo: 'Se revirtió la Beca SEP',
        cuerpo: `<p>Por indicación de Dirección General, a ${alumno} se le quitó la Beca SEP del ciclo ${esc(ciclo)} y regresa a ${beca}.</p>
${filas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #dce4f2;border-bottom:1px solid #dce4f2;margin:12px 0">${filas}</table>` : ''}
<p style="color:#5e6c84;font-size:13px">Lo que ya pagó con la Beca SEP se comparó contra el precio con su beca del colegio; la diferencia se reparte en partes iguales en los meses que faltan. El cambio se verá reflejado en Servicios Administrativos.</p>`,
      };
    }
  }
}

/** 2026-10-12 - HTML completo de un correo (vista previa y pruebas), sin enviarlo. */
export function htmlCorreoSep(tipo: TipoCorreoSep, s: SolicitudSep, extra: { motivo?: string; pagos?: ResumenPagos; por?: ActorSep } = {}) {
  const { asunto, titulo, cuerpo } = contenido(tipo, s, extra);
  return { asunto, html: marco(titulo, cuerpo) };
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

/**
 * 2026-10-12 - Recordatorio para la familia que contestó en el cuestionario que ya recibió la Beca SEP
 * pero todavía no sube su documento. No hay trámite (ni historial), así que el límite de frecuencia lo
 * lleva quien llama (bitácora). Mismo interruptor que los demás: apagado → solo al buzón de prueba.
 */
export async function correoRecordatorioDocumentoSep(a: {
  alumnoId: number;
  alumnoRef: number;
  nombre: string;
  ciclo: number;
}): Promise<{ enviado: boolean; detalle: string }> {
  try {
    const nombre = nombrePropio(a.nombre);
    const asunto = `Beca SEP: falta subir el documento de ${nombre}`;
    const html = marco(
      'Falta su documento de Beca SEP',
      `<p>En el cuestionario de becas nos indicó que <strong>${esc(nombre)}</strong> (No. de control ${a.alumnoRef}) recibió la Beca SEP para el ciclo ${esc(getSchoolCycleLabel(a.ciclo))}, pero todavía no hemos recibido el documento de autorización.</p>
<p>Entre al Portal de Becas → Beca SEP con el número de control y la contraseña del alumno y suba el documento (PDF o foto legible). Con él, Control Escolar podrá aplicar el descuento a sus mensualidades.</p>
<p style="color:#5e6c84;font-size:13px">Si ya lo entregó o la información del cuestionario no es correcta, comuníquese con Control Escolar.</p>`
    );
    const destino = correosSepSoloPrueba() ? [buzonPruebaSep()] : await correosFamilia(a.alumnoId);
    if (esModoLocalSoloLectura()) {
      const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${a.alumnoRef}-recordatorio`;
      await guardarVistaLocal(base, html, [], destino);
    }
    if (!destino.length) return { enviado: false, detalle: 'La familia no tiene correo registrado para avisos.' };
    await sendMail({
      to: destino,
      subject: asunto,
      html,
      text: textoPlano(html),
      headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
      replyTo: process.env.BECAS_SEP_REPLY_TO?.trim() || undefined,
    });
    const local = esModoLocalSoloLectura() ? ' (modo local: no salió, vista previa en .local-sep/correos)' : '';
    return { enviado: true, detalle: `Enviado a ${destino.map(ocultar).join(', ')}${local}.` };
  } catch (e) {
    console.error('[sep] recordatorio documento', a.alumnoRef, e);
    return { enviado: false, detalle: `No se pudo enviar: ${e instanceof Error ? e.message : 'error'}.` };
  }
}