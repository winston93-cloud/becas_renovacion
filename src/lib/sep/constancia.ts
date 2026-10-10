/**
 * 2026-10-09 - Constancia en PDF de la Beca SEP aplicada: desglose del cálculo, mensualidades a pagar,
 * beca del colegio que se perdió y quién aplicó. Se adjunta al correo de la familia y se descarga en el panel.
 */
import 'server-only';
import { ADMIN_ROLES, isAdminRole } from '@/lib/admin-roles';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import {
  contentBottom,
  createLetterDoc,
  docToBuffer,
  drawFieldRow,
  drawFooter,
  drawHeader,
  drawSectionTitle,
  ensureSpace,
} from '@/lib/pdf/layout';
import { LETTER, PDF_COLORS } from '@/lib/pdf/palette';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { pesos } from '@/lib/sep/core/dinero';
import { armarHojaCalculo } from '@/lib/sep/core/hojaCalculo';
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

export async function constanciaSepPdf(s: SolicitudSep): Promise<Buffer> {
  if (!s.calculo) throw new Error('El trámite no tiene cálculo aplicado.');
  const hoja = armarHojaCalculo(s.calculo.entrada);
  const r = s.calculo.entrada.resultado;
  const mensual = s.ajusteManual?.monto ?? s.calculo.montoMensual;
  const doc = createLetterDoc();
  const listo = docToBuffer(doc);
  const ancho = LETTER.width - LETTER.margin * 2;
  const mitad = LETTER.margin + ancho / 2 + 6;

  /** Dos campos lado a lado a la misma altura (drawFieldRow en modo half no regresa doc.y). */
  const par = (izq: [string, string], der: [string, string]) => {
    const y0 = doc.y;
    drawFieldRow(doc, izq[0], izq[1], { half: true });
    const yIzq = doc.y;
    doc.y = y0;
    drawFieldRow(doc, der[0], der[1], { half: true, x: mitad });
    doc.x = LETTER.margin;
    doc.y = Math.max(yIzq, doc.y, y0 + 26) + 4;
  };

  drawHeader(doc, 'Constancia de Beca SEP aplicada');

  drawSectionTitle(doc, 'Alumno');
  const nivel = s.nivel != null ? NOMBRE_NIVEL[s.nivel] ?? `Nivel ${s.nivel}` : '—';
  drawFieldRow(doc, 'Nombre', s.nombreAlumno);
  par(['No. de control', String(s.alumnoRef)], ['Nivel y grado', `${nivel}${s.grado ? ` ${s.grado}°` : ''}`]);
  par(['Ciclo escolar', getSchoolCycleLabel(s.ciclo)], ['Folio', folioSep(s)]);

  drawSectionTitle(doc, 'Beca');
  par(
    ['Beca SEP otorgada', `${s.porcentajeConfirmado ?? s.calculo.porcentajeSep} %`],
    [
      'Beca del colegio que se pierde',
      s.becaSustituida
        ? `${s.becaSustituida.clase ? `${s.becaSustituida.clase} ` : ''}${s.becaSustituida.porcentaje} %`
        : 'No tenía otra beca',
    ]
  );
  if (s.becaSustituida) {
    doc
      .fontSize(9)
      .fillColor(PDF_COLORS.textSecondary)
      .text(
        'La beca del colegio se sustituye por la Beca SEP y no se renovará el próximo ciclo escolar; si la familia la quiere de nuevo, deberá solicitarla como solicitud nueva.',
        LETTER.margin,
        doc.y,
        { width: ancho }
      );
    doc.fillColor(PDF_COLORS.text);
    doc.moveDown(0.8);
  }

  drawSectionTitle(doc, 'Cálculo');
  par(['Colegiatura oficial', pesos(s.calculo.entrada.colegiaturaOficial)], ['Colegiatura con Beca SEP', pesos(r.colSep)]);
  par(
    [r.excedenteTotal >= 0 ? 'Saldo a favor de lo ya pagado' : 'Saldo en contra de lo ya pagado', pesos(Math.abs(r.excedenteTotal))],
    ['Meses por pagar', `${hoja.mesesPorPagar.length}`]
  );
  par(['Mensualidad a pagar', pesos(mensual)], ['Saldo a favor al terminar el ciclo', pesos(hoja.saldoSobrante)]);
  if (s.ajusteManual) {
    doc.fontSize(9).fillColor(PDF_COLORS.textSecondary).text(`Ajuste de Dirección General: ${s.ajusteManual.motivo}`, LETTER.margin, doc.y, { width: ancho });
    doc.fillColor(PDF_COLORS.text);
    doc.moveDown(0.8);
  }

  if (hoja.reparto.length) {
    drawSectionTitle(doc, 'Mensualidades por pagar');
    const cols = [
      { t: 'Mes', w: 0.34, a: 'left' as const },
      { t: 'Con Beca SEP', w: 0.22, a: 'right' as const },
      { t: 'Saldo aplicado', w: 0.22, a: 'right' as const },
      { t: 'A pagar', w: 0.22, a: 'right' as const },
    ];
    const fila = (valores: string[], negrita = false) => {
      ensureSpace(doc, 18);
      let x = LETTER.margin;
      const yy = doc.y;
      doc.fontSize(9).font(negrita ? 'Helvetica-Bold' : 'Helvetica');
      valores.forEach((v, i) => {
        const w = ancho * cols[i].w;
        doc.text(v, x + 4, yy, { width: w - 8, align: cols[i].a, lineBreak: false });
        x += w;
      });
      doc.y = yy + 16;
      doc.moveTo(LETTER.margin, doc.y - 3).lineTo(LETTER.margin + ancho, doc.y - 3).strokeColor(PDF_COLORS.border).lineWidth(0.5).stroke();
    };
    fila(cols.map((c) => c.t), true);
    for (const m of hoja.reparto) {
      const saldo = m.abono > 0 ? `− ${pesos(m.abono)}` : m.abono < 0 ? `+ ${pesos(-m.abono)}` : '—';
      fila([m.nombre, pesos(m.conSep), saldo, pesos(s.ajusteManual?.monto ?? m.aPagar)]);
    }
    doc.font('Helvetica').moveDown(0.6);
  }

  ensureSpace(doc, 90);
  drawSectionTitle(doc, 'Aplicación');
  par(['Aplicó', quienAplico(s.revisadoPor)], ['Fecha de aplicación', fechaLarga(s.aplicadaEn)]);

  if (doc.y + 30 < contentBottom()) {
    doc
      .fontSize(8)
      .fillColor(PDF_COLORS.textSecondary)
      .text(
        'Constancia generada automáticamente por el Portal de Becas con los pagos registrados al momento de aplicar. Para cualquier duda comuníquese con Control Escolar.',
        LETTER.margin,
        doc.y + 6,
        { width: ancho }
      );
  }
  drawFooter(doc);
  doc.end();
  return listo;
}
