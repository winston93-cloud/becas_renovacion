/**
 * 2026-10-07 - Tipos del trámite Beca SEP dentro del módulo de becas.
 * Flujo: familia sube documento → envía → Control Escolar revisa y aplica (o pide corrección).
 */
import type { Alerta } from '@/lib/sep/core/alertas';
import type { EntradaHoja } from '@/lib/sep/core/hojaCalculo';
import type { EstadoProrrateo } from '@/lib/sep/core/prorrateo';

export type EstadoSep = 'borrador' | 'enviada' | 'correccion' | 'aplicada' | 'rechazada';

export const ETIQUETA_ESTADO_SEP: Record<EstadoSep, string> = {
  borrador: 'Sin enviar',
  enviada: 'En revisión de Control Escolar',
  correccion: 'Corrección solicitada',
  aplicada: 'Beca aplicada',
  rechazada: 'Rechazada',
};

/** Resultado de leer el documento de autorización SEP. */
export type DeteccionDocumento = {
  /** Cómo se leyó: texto del PDF, OCR de foto/escaneo (2026-10-08), o no se pudo. */
  metodo: 'pdf-texto' | 'ocr' | 'sin-texto';
  legible: boolean;
  /** Fragmento del documento donde aparece el nombre del alumno (si se encontró). */
  nombreDetectado: string | null;
  /** 0 a 1: qué tanto se parece al nombre del alumno de la sesión. */
  puntajeNombre: number;
  coincideNombre: boolean;
  /** Porcentaje de beca más probable encontrado en el documento. */
  porcentajeDetectado: number | null;
  porcentajesEncontrados: number[];
  palabrasClave: string[];
  pareceDocumentoSep: boolean;
  /** true = la familia puede enviar sin advertencias. */
  valido: boolean;
  /** Mensajes en lenguaje claro para la familia y Control Escolar. */
  motivos: string[];
  textoMuestra: string;
};

export type DocumentoSep = {
  id: string;
  nombreOriginal: string;
  /** Clave del archivo en el almacén (local hoy, Storage de InsForge después). */
  clave: string;
  tipo: string;
  tamano: number;
  subidoEn: string;
  deteccion: DeteccionDocumento;
};

export type ActorSep = 'familia' | 'ce_mk' | 'ce_pri' | 'ce_sec' | 'sistemas' | 'sistema';

export type EventoSep = {
  fecha: string;
  actor: ActorSep;
  accion:
    | 'aviso_aceptado'
    | 'documento_subido'
    | 'documento_invalido'
    | 'enviada'
    | 'porcentaje_corregido'
    | 'correccion_solicitada'
    | 'aplicada'
    | 'rechazada'
    | 'ajuste_manual'
    | 'recalculada'
    // 2026-10-09 - Correos a la familia y avisos de pagos distintos a la mensualidad aplicada.
    | 'correo_familia'
    | 'aviso_pago';
  detalle?: string;
  /** 2026-10-09 - Solo en correos a la familia: tipo y si salió (para limitar la frecuencia y no parecer spam). */
  correo?: { tipo: TipoCorreoSep; enviado: boolean };
};

export type TipoCorreoSep = 'recibido' | 'correccion' | 'aplicada' | 'actualizada' | 'pago';

/** 2026-10-09 - Beca del colegio que la familia pierde al aplicarse la SEP (movimiento para Renovaciones). */
export type BecaSustituida = {
  becaId: number | null;
  /** Nombre del concepto de beca (becas_concepto_beca.beca_clase). */
  clase: string | null;
  porcentaje: number;
  /** Ciclo en que se perdió (= ciclo del trámite SEP). */
  ciclo: number;
};

/** Foto del cálculo al aplicar (o al recalcular desde Sistemas). */
export type CalculoGuardado = {
  entrada: EntradaHoja;
  porcentajeSep: number;
  montoMensual: number | null;
  estado: EstadoProrrateo | null;
  saldoFavor: number;
  alertas: Alerta[];
  nivel: number | null;
  calculadoEn: string;
};

export type SolicitudSep = {
  id: string;
  alumnoId: number;
  alumnoRef: number;
  nombreAlumno: string;
  nivel: number | null;
  grado: number | null;
  ciclo: number;
  estado: EstadoSep;
  /** Historial de documentos; el último es el vigente. */
  documentos: DocumentoSep[];
  intentosFallidos: number;
  porcentajeDetectado: number | null;
  porcentajeConfirmado: number | null;
  motivoCorreccion: string | null;
  enviadaEn: string | null;
  revisadaEn: string | null;
  revisadoPor: ActorSep | null;
  aplicadaEn: string | null;
  calculo: CalculoGuardado | null;
  ajusteManual: { monto: number; motivo: string; por: ActorSep; fecha: string } | null;
  /** Integración con cobro (servicios_admin). En local siempre queda pendiente. */
  cobro: { estado: 'pendiente_integracion' | 'aplicado'; detalle: string; fecha: string } | null;
  /** 2026-10-09 - Beca del colegio que se perdió al aplicar (null = no tenía). Opcional en trámites viejos. */
  becaSustituida?: BecaSustituida | null;
  /**
   * 2026-10-09 - Mensualidad esperada por concepto de colegiatura (01–10, 26) desde que se aplicó.
   * Sirve para avisar si la familia paga de menos o de más.
   */
  esperados?: Record<string, number>;
  historial: EventoSep[];
  creadaEn: string;
  actualizadaEn: string;
};

export const MAX_INTENTOS_DOCUMENTO = 3;

/**
 * 2026-10-08 - Aviso que la familia confirma antes de subir cualquier documento SEP. El mismo texto se
 * muestra en pantalla y se guarda en el historial del trámite como constancia.
 * 2026-10-09 - Incluye que la beca que se pierde no se renueva el próximo ciclo (hay que solicitarla de nuevo).
 */
/** 2026-10-09 - Tope fijo para cualquier documento SEP (PDF, JPG o PNG): 5 MB, sin excepciones. */
export const MAX_MB_DOCUMENTO_SEP = 5;
export const MAX_BYTES_DOCUMENTO_SEP = MAX_MB_DOCUMENTO_SEP * 1024 * 1024;
export const MENSAJE_LIMITE_DOCUMENTO_SEP = `El archivo pesa más de ${MAX_MB_DOCUMENTO_SEP} MB y no se puede recibir. Si es foto, tómela con menor calidad; si es PDF, escanéelo en blanco y negro o a menor resolución.`;

export const AVISO_OTRAS_BECAS =
  'Entiendo que al agregar la beca SEP mi hijo(a) pierde el beneficio de cualquier otra beca que tenga en el colegio, que esa beca no se renovará el próximo ciclo escolar (tendría que solicitarla de nuevo), y deseo continuar.';
