/**
 * 2026-07-16 - Barrel export de generadores PDF.
 */
export { buildSolicitudPdf } from './solicitud';
export type { BuildSolicitudPdfOptions } from './solicitud';
export { buildComprobantePdf } from './comprobante';
export type {
  PdfSolicitudData,
  PdfComprobanteData,
  PdfFamiliar,
  PdfHermano,
} from './types';
export { PDF_COLORS, LETTER } from './palette';
