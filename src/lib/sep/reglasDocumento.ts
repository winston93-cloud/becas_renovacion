/**
 * 2026-10-07 - Reglas PROVISIONALES para reconocer el documento de autorización de Beca SEP.
 * Aún no hay un documento real de muestra: cuando llegue, ajustar solo este archivo
 * (palabras clave, patrón del porcentaje y umbral del nombre). Función pura, sin E/S.
 */
import { puntajeNombre, tokensNombre } from '@/lib/sep/core/nombres';
import type { DeteccionDocumento } from '@/lib/sep/tipos';

/** Texto mínimo para considerar que el PDF trae texto (si no, es escaneo o foto). */
export const MIN_CARACTERES_TEXTO = 40;
/** Parecido mínimo entre el nombre del alumno y el del documento. */
export const UMBRAL_NOMBRE = 0.85;

const CLAVES_SEP = ['sep', 'secretaria de educacion', 'educacion publica'];
const CLAVES_BECA = ['beca', 'becas'];
const CLAVES_EXTRA = ['autoriza', 'autorizacion', 'autorizado', 'porcentaje', 'ciclo escolar', 'escuela particular', 'incorporada'];

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const contiene = (texto: string, clave: string) =>
  new RegExp(`(^|[^a-z0-9])${clave.replace(/ /g, '\\s+')}([^a-z0-9]|$)`).test(texto);

/** Porcentajes del texto ("50 %", "50%", "50 por ciento", "50.5%"), entre 1 y 100. */
export function porcentajesDelTexto(texto: string): { valor: number; pos: number }[] {
  const t = sinAcentos(texto);
  const out: { valor: number; pos: number }[] = [];
  for (const m of t.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:%|por\s*ciento)/g)) {
    const valor = Number(m[1].replace(',', '.'));
    if (Number.isFinite(valor) && valor > 0 && valor <= 100) out.push({ valor, pos: m.index ?? 0 });
  }
  return out;
}

/** El porcentaje más probable: el más cercano a la palabra "beca"; si no, el más repetido. */
export function porcentajeProbable(texto: string): { valor: number | null; todos: number[] } {
  const lista = porcentajesDelTexto(texto);
  const todos = Array.from(new Set(lista.map((p) => p.valor)));
  if (!lista.length) return { valor: null, todos };
  const t = sinAcentos(texto);
  const posBeca = Array.from(t.matchAll(/beca/g)).map((m) => m.index ?? 0);
  if (posBeca.length) {
    const cerca = lista
      .map((p) => ({ ...p, dist: Math.min(...posBeca.map((b) => Math.abs(b - p.pos))) }))
      .filter((p) => p.dist <= 200)
      .sort((a, b) => a.dist - b.dist);
    if (cerca.length) return { valor: cerca[0].valor, todos };
  }
  const conteo = new Map<number, number>();
  for (const p of lista) conteo.set(p.valor, (conteo.get(p.valor) ?? 0) + 1);
  const [valor] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
  return { valor, todos };
}

/** Busca el nombre del alumno en el texto con una ventana de palabras (sin importar orden ni acentos). */
export function buscarNombre(texto: string, nombreAlumno: string): { puntaje: number; fragmento: string | null } {
  const objetivo = tokensNombre(nombreAlumno);
  const palabras = tokensNombre(texto);
  if (!objetivo.length || !palabras.length) return { puntaje: 0, fragmento: null };
  let mejor = { puntaje: 0, fragmento: null as string | null };
  for (const largo of [objetivo.length, objetivo.length + 1, objetivo.length - 1]) {
    if (largo < 2) continue;
    for (let i = 0; i + largo <= palabras.length; i++) {
      const ventana = palabras.slice(i, i + largo).join(' ');
      const p = puntajeNombre(nombreAlumno, ventana);
      if (p > mejor.puntaje) mejor = { puntaje: p, fragmento: ventana };
    }
  }
  return mejor;
}

export function documentoIlegible(metodoMotivo: string): DeteccionDocumento {
  return {
    metodo: 'sin-texto',
    legible: false,
    nombreDetectado: null,
    puntajeNombre: 0,
    coincideNombre: false,
    porcentajeDetectado: null,
    porcentajesEncontrados: [],
    palabrasClave: [],
    pareceDocumentoSep: false,
    valido: false,
    motivos: [
      metodoMotivo,
      'Control Escolar revisará el documento a mano; puede enviarlo así.',
    ],
    textoMuestra: '',
  };
}

const DIGITO_OCR: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', S: '5', s: '5', B: '8' };

/**
 * 2026-10-08 - Corrige confusiones típicas del OCR en los porcentajes: "2O %" → "20 %", "l00%" → "100%",
 * "50 0/0" o "50 o/o" → "50 %". Solo toca grupos pegados a un signo de porcentaje y con al menos un dígito.
 */
export function normalizarTextoOcr(texto: string): string {
  return texto
    .replace(/(\d)\s*[0oO]\s*\/\s*[0oO](?![\w])/g, '$1 %')
    .replace(/(^|[^\w])([0-9OoDQIl|SsB]{1,3})(\s*%)/g, (todo, antes: string, grupo: string, signo: string) =>
      /\d/.test(grupo) ? antes + grupo.replace(/[^\d]/g, (c) => DIGITO_OCR[c] ?? c) + signo : todo
    );
}

/**
 * Analiza el texto ya extraído del documento contra el alumno de la sesión.
 * 2026-10-08 - `metodo: 'ocr'` cuando el texto viene de una foto o escaneo (se normaliza antes).
 */
export function analizarTexto(
  texto: string,
  nombreAlumno: string,
  metodo: 'pdf-texto' | 'ocr' = 'pdf-texto'
): DeteccionDocumento {
  const limpio = (metodo === 'ocr' ? normalizarTextoOcr(texto) : texto).replace(/\s+/g, ' ').trim();
  if (limpio.length < MIN_CARACTERES_TEXTO) {
    return documentoIlegible(
      metodo === 'ocr'
        ? 'No se pudo leer el texto de la imagen (puede estar borrosa, oscura o cortada).'
        : 'El PDF no tiene texto que se pueda leer (parece escaneado).'
    );
  }
  const t = sinAcentos(limpio);
  const palabrasClave = [...CLAVES_SEP, ...CLAVES_BECA, ...CLAVES_EXTRA].filter((c) => contiene(t, c));
  const pareceDocumentoSep =
    CLAVES_SEP.some((c) => palabrasClave.includes(c)) && CLAVES_BECA.some((c) => palabrasClave.includes(c));
  const nombre = buscarNombre(limpio, nombreAlumno);
  const coincideNombre = nombre.puntaje >= UMBRAL_NOMBRE;
  const pct = porcentajeProbable(limpio);

  const motivos: string[] = [];
  if (!pareceDocumentoSep) {
    motivos.push('No parece el documento de autorización de beca de la SEP (no menciona SEP y beca).');
  }
  if (!coincideNombre) {
    motivos.push(
      nombre.fragmento && nombre.puntaje >= 0.5
        ? `El nombre del documento no coincide del todo con el del alumno (se leyó "${nombre.fragmento}").`
        : 'No se encontró el nombre del alumno en el documento.'
    );
  }
  if (pct.valor == null) {
    motivos.push('No se encontró el porcentaje de beca autorizado.');
  } else if (pct.todos.length > 1) {
    motivos.push(
      `El documento trae varios porcentajes (${pct.todos.join('%, ')}%); se tomó ${pct.valor}%. Control Escolar lo confirmará.`
    );
  }

  return {
    metodo,
    legible: true,
    nombreDetectado: nombre.fragmento,
    puntajeNombre: nombre.puntaje,
    coincideNombre,
    porcentajeDetectado: pct.valor,
    porcentajesEncontrados: pct.todos,
    palabrasClave,
    pareceDocumentoSep,
    valido: pareceDocumentoSep && coincideNombre && pct.valor != null,
    motivos,
    textoMuestra: limpio.slice(0, 1500),
  };
}
