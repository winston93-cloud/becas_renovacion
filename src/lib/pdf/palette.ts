/**
 * 2026-07-16 - Paleta institucional para PDFs (alineada al portal).
 */
export const PDF_COLORS = {
  primary: '#0B173A',
  primaryLight: '#EAF0FA',
  text: '#16213E',
  textSecondary: '#5E6C84',
  border: '#DCE4F2',
  bg: '#F7F9FC',
  white: '#FFFFFF',
  success: '#2E7D32',
} as const;

/** US Letter en puntos PDF (72 dpi) */
export const LETTER = {
  width: 612,
  height: 792,
  margin: 48,
  // 2026-07-16 - Altura de la cintilla footer (debe coincidir con bottom margin)
  footerBand: 40,
} as const;
