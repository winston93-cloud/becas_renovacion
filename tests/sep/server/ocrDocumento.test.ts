// 2026-10-08 - OCR Beca SEP con Tesseract: foto chueca/borrosa, foto de lado y PDF escaneado
// (se generan aquí con sharp + pdfkit; no se usan documentos reales).
import { describe, expect, it, afterAll } from 'vitest';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { cerrarOcr, ocrImagen, ocrPdfEscaneado } from '@/lib/sep/ocrDocumento';
import { analizarTexto, normalizarTextoOcr } from '@/lib/sep/reglasDocumento';

const ALUMNO = 'NAJERA CEPEDA MAXIMILIANO';

function svgDocumento(): Buffer {
  const lineas = [
    ['SECRETARÍA DE EDUCACIÓN PÚBLICA', 54, 'bold'],
    ['Programa de Becas en Escuelas Particulares Incorporadas', 34, 'normal'],
    ['Se autoriza al alumno(a) NAJERA CEPEDA MAXIMILIANO', 34, 'normal'],
    ['una beca del 50 % para el ciclo escolar 2026-2027.', 34, 'normal'],
  ] as const;
  const texto = lineas
    .map(([t, size, peso], i) => `<text x="80" y="${180 + i * 90}" font-family="DejaVu Sans, Arial" font-size="${size}" font-weight="${peso}">${t}</text>`)
    .join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="700"><rect width="100%" height="100%" fill="#fff"/>${texto}</svg>`);
}

/** Simula una foto de celular: fondo grisáceo, ligeramente girada, borrosa y en JPG de baja calidad. */
async function fotoCelular(giro = 0, { inclinacion = 3, brillo = 0.9, desenfoque = 0.8, calidad = 55 } = {}): Promise<Buffer> {
  const papel = await sharp(svgDocumento()).png().toBuffer();
  return sharp(papel)
    .rotate(inclinacion, { background: '#d8d4cc' })
    .modulate({ brightness: brillo })
    .blur(desenfoque)
    .rotate(giro, { background: '#d8d4cc' })
    .jpeg({ quality: calidad })
    .toBuffer();
}

async function pdfEscaneado(): Promise<Buffer> {
  const imagen = await fotoCelular();
  return new Promise((ok, mal) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => ok(Buffer.concat(partes)));
    doc.on('error', mal);
    doc.image(imagen, 0, 0, { width: 612 });
    doc.end();
  });
}

describe('normalizarTextoOcr', () => {
  it('corrige letras confundidas con números junto al %', () => {
    expect(normalizarTextoOcr('beca del 2O % para')).toBe('beca del 20 % para');
    expect(normalizarTextoOcr('beca del l00%')).toBe('beca del 100%');
    expect(normalizarTextoOcr('beca del 5O%')).toBe('beca del 50%');
    expect(normalizarTextoOcr('beca del 50 0/0')).toBe('beca del 50 %');
  });
  it('no toca palabras ni fechas', () => {
    expect(normalizarTextoOcr('SOS % beca')).toBe('SOS % beca');
    expect(normalizarTextoOcr('fecha 10/02/2026')).toBe('fecha 10/02/2026');
  });
});

describe('OCR del documento SEP (Tesseract)', { timeout: 120_000 }, () => {
  afterAll(() => cerrarOcr());

  it('lee una foto chueca y borrosa', async () => {
    const r = await ocrImagen(await fotoCelular());
    const d = analizarTexto(r.texto, ALUMNO, 'ocr');
    expect(d.metodo).toBe('ocr');
    expect(d.coincideNombre).toBe(true);
    expect(d.porcentajeDetectado).toBe(50);
    expect(d.pareceDocumentoSep).toBe(true);
  });

  it('lee una foto más inclinada y oscura (el modo automático de Tesseract no encuentra renglones)', async () => {
    const r = await ocrImagen(await fotoCelular(0, { inclinacion: 4, brillo: 0.88, desenfoque: 0.9, calidad: 50 }));
    const d = analizarTexto(r.texto, ALUMNO, 'ocr');
    expect(d.coincideNombre).toBe(true);
    expect(d.porcentajeDetectado).toBe(50);
  });

  it('lee una foto tomada de lado (90°)', async () => {
    const r = await ocrImagen(await fotoCelular(90));
    const d = analizarTexto(r.texto, ALUMNO, 'ocr');
    expect(d.coincideNombre).toBe(true);
    expect(d.porcentajeDetectado).toBe(50);
  });

  it('lee un PDF escaneado', async () => {
    const r = await ocrPdfEscaneado(await pdfEscaneado());
    const d = analizarTexto(r.texto, ALUMNO, 'ocr');
    expect(d.coincideNombre).toBe(true);
    expect(d.porcentajeDetectado).toBe(50);
    expect(d.valido).toBe(true);
  });
});
