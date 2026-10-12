/**
 * 2026-10-09 - Constancia en PDF de la Beca SEP aplicada: desglose del cálculo, mensualidades a pagar,
 * beca del colegio que se perdió y quién aplicó. Se adjunta al correo de la familia y se descarga en el panel.
 * 2026-10-12 - Identidad de winston93.edu.mx (logo, azul #013BDF / #012A9E, acento #E3FB07) y cálculo
 * resumido en tres pasos con la inscripción incluida (mismos números que el correo).
 */
import 'server-only';
import { ADMIN_ROLES, isAdminRole } from '@/lib/admin-roles';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { createLetterDoc, docToBuffer, drawFieldRow } from '@/lib/pdf/layout';
import { LOGO_WINSTON_PNG_BASE64, LOGO_WINSTON_PROPORCION } from '@/lib/pdf/logoWinston';
import { LETTER, PDF_COLORS } from '@/lib/pdf/palette';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { armarHojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { periodoMeses, resumenFamiliaSep } from '@/lib/sep/core/resumenFamilia';
import type { ActorSep, SolicitudSep } from '@/lib/sep/tipos';

/** "Control Escolar · Primaria", "Dirección General"… */
export function quienAplico(actor: ActorSep | null): string {
  if (!actor || !isAdminRole(actor)) return 'Control Escolar';
  return actor === 'sistemas' ? ADMIN_ROLES.sistemas.label : `Control Escolar · ${ADMIN_ROLES[actor].label}`;
}

export const fechaLarga = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City' })
    : '—';

export const folioSep = (s: Pick<SolicitudSep, 'id' | 'alumnoRef'>) => `SEP-${s.alumnoRef}-${s.id.slice(0, 8).toUpperCase()}`;

const AZUL = '#013BDF';
const AZUL_OSCURO = '#012A9E';
const ACENTO = '#E3FB07';
const AZUL_SUAVE = '#EEF2FF';
const VERDE = '#2E7D32';
const ROJO = '#B42318';
const PIE = 40;
// Helvetica del PDF (WinAnsi) no trae el signo menos tipográfico (U+2212): se usa el guion normal.

type Col = { t: string; w: number; a: 'left' | 'right' };

export async function constanciaSepPdf(s: SolicitudSep): Promise<Buffer> {
  if (!s.calculo) throw new Error('El trámite no tiene cálculo aplicado.');
  const hoja = armarHojaCalculo(s.calculo.entrada);
  const f = resumenFamiliaSep(s.calculo.entrada, hoja.mesesPorPagar, s.ajusteManual?.monto ?? null);
  const pct = s.porcentajeConfirmado ?? f.porcentajeSep;
  const n = f.mesesPorPagar.length;
  const periodo = periodoMeses(f.mesesPorPagar);
  const doc = createLetterDoc();
  const listo = docToBuffer(doc);
  const M = LETTER.margin;
  const ancho = LETTER.width - M * 2;
  const mitad = M + ancho / 2 + 6;
  const limite = LETTER.height - PIE;
  const logo = Buffer.from(LOGO_WINSTON_PNG_BASE64, 'base64');

  const pie = () => {
    const guardado = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = LETTER.height - PIE;
    doc.rect(0, y, LETTER.width, PIE).fill(AZUL_OSCURO);
    doc.rect(0, y, LETTER.width, 2).fill(ACENTO);
    const ty = y + (PIE - 8) / 2 + 1;
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica')
      .text('Instituto Winston Churchill · Portal de Becas', M, ty, { width: ancho / 2, lineBreak: false });
    doc.fillColor(ACENTO).font('Helvetica-Bold')
      .text('winston93.edu.mx', M + ancho / 2, ty, { width: ancho / 2, align: 'right', lineBreak: false });
    doc.page.margins.bottom = guardado;
    doc.fillColor(PDF_COLORS.text).font('Helvetica');
  };

  const encabezado = (titulo: string) => {
    const wLogo = 150;
    doc.image(logo, M, 26, { width: wLogo });
    doc.fillColor(PDF_COLORS.textSecondary).fontSize(8).font('Helvetica')
      .text('INSTITUTO WINSTON CHURCHILL · PORTAL DE BECAS', M + wLogo + 20, 30, { width: ancho - wLogo - 20, align: 'right', characterSpacing: 0.8 });
    doc.fillColor(AZUL_OSCURO).fontSize(16).font('Helvetica-Bold')
      .text(titulo, M + wLogo + 20, 44, { width: ancho - wLogo - 20, align: 'right' });
    const yBarra = 26 + wLogo * LOGO_WINSTON_PROPORCION + 18;
    doc.rect(0, yBarra, LETTER.width, 5).fill(AZUL);
    doc.rect(0, yBarra + 5, LETTER.width, 2).fill(ACENTO);
    doc.fillColor(PDF_COLORS.text).font('Helvetica');
    doc.x = M;
    doc.y = yBarra + 20;
  };

  /** Salto de página con el mismo pie y encabezado reducido. */
  const espacio = (necesario: number) => {
    if (doc.y + necesario <= limite - 10) return;
    pie();
    doc.addPage();
    doc.rect(0, 0, LETTER.width, 5).fill(AZUL);
    doc.rect(0, 5, LETTER.width, 2).fill(ACENTO);
    doc.fillColor(PDF_COLORS.text);
    doc.x = M;
    doc.y = M;
  };

  const seccion = (titulo: string) => {
    espacio(50);
    const y = doc.y + 4;
    doc.rect(M, y, ancho, 22).fill(AZUL_SUAVE);
    doc.rect(M, y, 4, 22).fill(AZUL);
    doc.fillColor(AZUL_OSCURO).fontSize(10).font('Helvetica-Bold').text(titulo, M + 12, y + 6.5);
    doc.fillColor(PDF_COLORS.text).font('Helvetica');
    doc.y = y + 30;
  };

  /** Dos campos lado a lado a la misma altura (drawFieldRow en modo half no regresa doc.y). */
  const par = (izq: [string, string], der: [string, string]) => {
    espacio(32);
    const y0 = doc.y;
    drawFieldRow(doc, izq[0], izq[1], { half: true });
    const yIzq = doc.y;
    doc.y = y0;
    drawFieldRow(doc, der[0], der[1], { half: true, x: mitad });
    doc.x = M;
    doc.y = Math.max(yIzq, doc.y, y0 + 26) + 4;
  };

  const nota = (t: string) => {
    espacio(24);
    doc.fontSize(8.5).fillColor(PDF_COLORS.textSecondary).font('Helvetica').text(t, M, doc.y, { width: ancho });
    doc.fillColor(PDF_COLORS.text);
    doc.moveDown(0.6);
  };

  /** Tabla simple; `colores` pinta celdas puntuales (fila, columna). */
  const tabla = (cols: Col[], filas: string[][], opts: { pie?: string[]; colores?: Record<string, string>; x?: number; w?: number } = {}) => {
    const x0 = opts.x ?? M;
    const w0 = opts.w ?? ancho;
    const fila = (valores: string[], tipo: 'enc' | 'normal' | 'pie', idx = -1) => {
      espacio(20);
      const yy = doc.y;
      if (tipo === 'enc') doc.rect(x0, yy - 3, w0, 18).fill('#F7F8FC');
      if (tipo === 'pie') doc.rect(x0, yy - 3, w0, 18).fill(AZUL_SUAVE);
      let x = x0;
      valores.forEach((v, i) => {
        const w = w0 * cols[i].w;
        const color = opts.colores?.[`${idx}:${i}`];
        doc.fontSize(tipo === 'enc' ? 8 : 9.5)
          .font(tipo === 'normal' ? 'Helvetica' : 'Helvetica-Bold')
          .fillColor(tipo === 'enc' ? PDF_COLORS.textSecondary : (color ?? (tipo === 'pie' ? AZUL_OSCURO : PDF_COLORS.text)))
          .text(v, x + 6, yy, { width: w - 12, align: cols[i].a, lineBreak: false });
        x += w;
      });
      doc.y = yy + 18;
      doc.moveTo(x0, doc.y - 3).lineTo(x0 + w0, doc.y - 3).strokeColor(PDF_COLORS.border).lineWidth(0.5).stroke();
    };
    fila(cols.map((c) => c.t), 'enc');
    filas.forEach((v, i) => fila(v, 'normal', i));
    if (opts.pie) fila(opts.pie, 'pie');
    doc.fillColor(PDF_COLORS.text).font('Helvetica');
    doc.moveDown(0.5);
  };

  /** Paso numerado: círculo azul con el número y el título a un lado. */
  const paso = (num: number, titulo: string) => {
    espacio(60);
    const y = doc.y + 4;
    doc.circle(M + 10, y + 9, 10).fill(AZUL);
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(String(num), M, y + 4, { width: 20, align: 'center' });
    doc.fillColor(AZUL_OSCURO).fontSize(11).text(titulo, M + 28, y + 3.5, { width: ancho - 28 });
    doc.fillColor(PDF_COLORS.text).font('Helvetica');
    doc.y = y + 26;
  };

  const texto = (t: string, negrita = false) => {
    espacio(18);
    doc.fontSize(10).font(negrita ? 'Helvetica-Bold' : 'Helvetica').fillColor(PDF_COLORS.text).text(t, M + 28, doc.y, { width: ancho - 28 });
    doc.font('Helvetica').moveDown(0.3);
  };

  encabezado('Constancia de Beca SEP');

  seccion('Alumno');
  const nivel = s.nivel != null ? NOMBRE_NIVEL[s.nivel] ?? `Nivel ${s.nivel}` : '—';
  drawFieldRow(doc, 'Nombre', s.nombreAlumno);
  par(['No. de control', String(s.alumnoRef)], ['Nivel y grado', `${nivel}${s.grado ? ` ${s.grado}°` : ''}`]);
  par(['Ciclo escolar', getSchoolCycleLabel(s.ciclo)], ['Folio', folioSep(s)]);

  seccion('Beca');
  par(
    ['Beca SEP otorgada', `${pct} %`],
    [
      'Beca del colegio que se pierde',
      s.becaSustituida
        ? `${s.becaSustituida.clase ? `${s.becaSustituida.clase} ` : ''}${s.becaSustituida.porcentaje} %`
        : 'No tenía otra beca',
    ]
  );
  if (s.becaSustituida) {
    nota('La beca del colegio se sustituye por la Beca SEP y no se renovará el próximo ciclo escolar; si la familia la quiere de nuevo, deberá solicitarla como solicitud nueva.');
  }

  seccion('Cálculo resumido');
  paso(1, `Sus precios con Beca SEP del ${pct} %`);
  const tablaX = M + 28;
  const tablaW = ancho - 28;
  tabla(
    [
      { t: 'Concepto', w: 0.5, a: 'left' },
      { t: 'Precio normal', w: 0.25, a: 'right' },
      { t: `Con Beca SEP ${pct} %`, w: 0.25, a: 'right' },
    ],
    [
      ['Inscripción', pesos(f.inscripcionOficial), pesos(f.inscripcionConSep)],
      [`Colegiatura mensual (plan de ${s.calculo.entrada.planMeses} meses)`, pesos(f.colegiaturaOficial), pesos(f.colegiaturaConSep)],
    ],
    { x: tablaX, w: tablaW }
  );

  paso(2, 'Lo que ya pagó, comparado con el precio con Beca SEP');
  if (f.pagados.length) {
    const colores: Record<string, string> = {};
    f.pagados.forEach((p, i) => {
      if (p.diferencia !== 0) colores[`${i}:3`] = p.diferencia > 0 ? VERDE : ROJO;
    });
    tabla(
      [
        { t: 'Concepto', w: 0.31, a: 'left' },
        { t: 'Pagó', w: 0.21, a: 'right' },
        { t: 'Con Beca SEP', w: 0.21, a: 'right' },
        { t: 'Diferencia', w: 0.27, a: 'right' },
      ],
      f.pagados.map((p) => [
        p.concepto,
        pesos(p.pago),
        pesos(p.conSep),
        p.diferencia > 0 ? `${pesos(p.diferencia)} a favor` : p.diferencia < 0 ? `${pesos(-p.diferencia)} en contra` : '—',
      ]),
      { x: tablaX, w: tablaW, colores, pie: [f.saldo >= 0 ? 'Saldo a su favor' : 'Saldo en contra', '', '', pesos(Math.abs(f.saldo))] }
    );
    doc.x = M;
    const recargos = 'Los recargos no cuentan en esta comparación.';
    doc.fontSize(8.5).fillColor(PDF_COLORS.textSecondary).text(
      s.becaSustituida
        ? `Lo que pagó con su beca del colegio (${s.becaSustituida.clase ?? 'beca'} ${s.becaSustituida.porcentaje} %) se compara contra el precio con Beca SEP. ${recargos}`
        : recargos,
      tablaX,
      doc.y,
      { width: tablaW }
    );
    doc.fillColor(PDF_COLORS.text).moveDown(0.6);
  } else {
    texto('Todavía no había pagado inscripción ni colegiaturas del ciclo, así que no hay saldo que repartir.');
  }

  if (f.anioCompleto) {
    paso(3, 'Su saldo cubre el resto del ciclo');
    texto(`Su saldo a favor (${pesos(f.saldo)}) alcanza para los ${n} meses que faltan (${periodo}): ${pesos(f.colegiaturaConSep)} × ${n} = ${pesos(f.colegiaturaConSep * n)}.`);
    texto(`No paga colegiatura el resto del ciclo${f.saldoAlFinal > 0 ? ` y le quedan ${pesos(f.saldoAlFinal)} a favor` : ''}.`, true);
  } else if (f.porMes != null && f.porMes !== 0) {
    paso(3, `Ese saldo se reparte en los ${n} meses que faltan`);
    texto(`${pesos(Math.abs(f.saldo))} ÷ ${n} meses (${periodo}) = ${pesos(Math.abs(f.porMes))} ${f.porMes > 0 ? 'menos' : 'más'} cada mes.`);
    texto(`${pesos(f.colegiaturaConSep)} ${f.porMes > 0 ? '-' : '+'} ${pesos(Math.abs(f.porMes))} = ${pesos(f.mensualCalculada)}`, true);
    if (f.topada) nota('La mensualidad no puede ser mayor que la colegiatura normal; se cobra la colegiatura normal.');
  } else {
    paso(3, 'Sin saldo que repartir');
    texto(`Paga el precio con Beca SEP en los ${n} meses que faltan (${periodo}).`);
  }

  espacio(76);
  const yRes = doc.y + 8;
  doc.roundedRect(M, yRes, ancho, 60, 8).fill(AZUL);
  doc.rect(M + ancho - 8, yRes, 8, 60).fill(ACENTO);
  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text('SU NUEVA MENSUALIDAD', M + 16, yRes + 10, { characterSpacing: 1 });
  doc.fontSize(22).font('Helvetica-Bold').text(f.anioCompleto ? pesos(0) : pesos(f.mensual), M + 16, yRes + 23);
  doc.fontSize(10).font('Helvetica')
    .text(`${n} ${n === 1 ? 'mes' : 'meses'}: ${periodo}`, M + ancho / 2, yRes + 28, { width: ancho / 2 - 24, align: 'right' });
  doc.fillColor(PDF_COLORS.text);
  doc.x = M;
  doc.y = yRes + 72;
  if (s.ajusteManual) nota(`Dirección General ajustó la mensualidad a ${pesos(s.ajusteManual.monto)}: ${s.ajusteManual.motivo}`);

  if (hoja.reparto.length) {
    seccion('Mensualidades por pagar');
    tabla(
      [
        { t: 'Mes', w: 0.34, a: 'left' },
        { t: 'Con Beca SEP', w: 0.22, a: 'right' },
        { t: 'Saldo aplicado', w: 0.22, a: 'right' },
        { t: 'A pagar', w: 0.22, a: 'right' },
      ],
      hoja.reparto.map((m) => [
        m.nombre,
        pesos(m.conSep),
        m.abono > 0 ? `- ${pesos(m.abono)}` : m.abono < 0 ? `+ ${pesos(-m.abono)}` : '—',
        pesos(s.ajusteManual?.monto ?? m.aPagar),
      ])
    );
  }

  seccion('Aplicación');
  par(['Aplicó', quienAplico(s.revisadoPor)], ['Fecha de aplicación', fechaLarga(s.aplicadaEn)]);
  nota('Constancia generada automáticamente por el Portal de Becas con los pagos registrados al momento de aplicar. Para cualquier duda comuníquese con Control Escolar.');

  pie();
  doc.end();
  return listo;
}
