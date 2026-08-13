/**
 * 2026-07-16 - Tipos del dominio de renovación de becas.
 * 2026-07-17 - Tipos de solicitud de beca (nuevo ingreso) añadidos abajo.
 */

export type Familiar = {
  id?: string;
  tutor_id: 1 | 2;
  familiar_app: string;
  familiar_apm: string;
  familiar_nombre: string;
  familiar_vive: boolean | null;
  /** 2026-07-17 - Legacy “ocupación”; se guarda en familiar_escolaridad */
  familiar_escolaridad: string | null;
  familiar_empresa_nombre: string | null;
  familiar_empresa_puesto: string | null;
  /** 2026-07-17 - Tel. oficina (legacy teloficina*) */
  familiar_empresa_tel: string | null;
  familiar_tel: string | null;
  familiar_cel: string | null;
  familiar_email: string | null;
};

export type Hermano = {
  orden: number;
  nombre: string;
  edad: number | null;
  institucion: string;
  colegiatura_mensual: number | null;
};

// 2026-08-13 - Renovación: ingresos|domicilio|comp_inscripcion (sin boleta SEP).
// Solicitud nueva: acta/CURP/etc.
export type DocumentoTipo =
  | 'ingresos'
  | 'domicilio'
  | 'boleta'
  | 'comp_inscripcion'
  | 'acta_nacimiento'
  | 'curp'
  | 'curp_tutor'
  | 'constancia_no_adeudo'
  | 'carta_buena_conducta'
  | 'boleta_interna';

export type Documento = {
  id: string;
  tipo: DocumentoTipo;
  storage_key: string;
  storage_url: string | null;
  nombre_original: string | null;
  subido_en: string;
  /** Estado de revisión admin (portal lo usa para correcciones). */
  revision_estado?: 'pendiente' | 'ok' | 'incorrecto' | 'reenviado';
  revision_nota?: string | null;
};

export type RenovacionPayload = {
  // 2026-07-16 - alumno_id entero de public.alumno (ya no uuid de becas_alumno)
  alumno_id: number;
  ingreso_mensual_padre: number | null;
  ingreso_mensual_madre: number | null;
  motivo: string;
  casa_tipo: string;
  otra_beca: boolean;
  otra_beca_porcentaje: number | null;
  observaciones: string;
  detalle: {
    alumno_calle: string;
    alumno_numero: string;
    alumno_colonia: string;
    alumno_cp: string;
  };
  mama: Partial<Familiar>;
  papa: Partial<Familiar>;
  hermanos: Hermano[];
};

export type RenovacionPrecarga = {
  /** Número interno: ciclo de beca origen a renovar (ej. 22) */
  ciclo_escolar: number;
  /** Ciclo calendario actual (ej. 23) */
  ciclo_calendario?: number;
  /** Texto visible a padres: siempre el ciclo nuevo, ej. "2026 - 2027" */
  ciclo_label: string;
  alumno: {
    id: number;
    alumno_ref: string;
    nombre_completo: string;
    alumno_app: string;
    alumno_apm: string;
    alumno_nombre: string;
    alumno_nivel: number | null;
    alumno_grado: number | null;
    alumno_grupo: string | null;
  };
  detalle: {
    alumno_calle: string | null;
    alumno_numero: string | null;
    alumno_colonia: string | null;
    alumno_cp: string | null;
  } | null;
  beca: {
    beca_id: number;
    beca_clase: string;
    beca_porcentaje: number;
    beca_promedio_requerido: number;
  };
  mama: Familiar | null;
  papa: Familiar | null;
  renovacion: {
    id: string;
    ingreso_mensual_padre: number | null;
    ingreso_mensual_madre: number | null;
    motivo: string | null;
    casa_tipo: string | null;
    otra_beca: boolean;
    otra_beca_porcentaje: number | null;
    observaciones: string | null;
    /** 2026-07-16 - true cuando ya se envió el correo de finalización */
    correo_enviado?: boolean;
    correo_enviado_en?: string | null;
  } | null;
  hermanos: Hermano[];
  documentos: Documento[];
  /**
   * true si ya finalizó renovación (correo_enviado).
   * Si además hay docs incorrectos, el portal abre carga de correcciones.
   */
  ya_registrado: boolean;
  /** Hay documentos marcados incorrecto que el padre puede re-subir. */
  docs_por_corregir?: boolean;
};

/**
 * 2026-07-17 - Tipos del dominio de solicitud de beca (nuevo ingreso).
 * Reemplaza el flujo legacy acceso.php → Index2.php → final2.php → envio2.php.
 */

export type ConceptoBeca = {
  beca_id: number;
  beca_clase: string;
};

export type SolicitudPayload = {
  alumno_id: number;
  beca_deseada_id: number | null;
  beca_porcentaje_deseado: number | null;
  tiene_otra_beca: boolean;
  otra_beca_sep: boolean; // 2026-07-18 - columna legacy; siempre false en UI/API (SEP no tramitable)
  otra_beca_pemex: boolean;
  otra_beca_empresarial: boolean;
  otra_beca_otro: boolean;
  aporta_gastos: boolean | null;
  parentesco_aportante: string;
  vivienda_tipo: string;
  motivo: string;
  ingreso_mensual_padre: number | null;
  ingreso_mensual_madre: number | null;
  detalle: {
    alumno_calle: string;
    alumno_numero: string;
    alumno_colonia: string;
    alumno_cp: string;
  };
  mama: Partial<Familiar>;
  papa: Partial<Familiar>;
  hermanos: Hermano[];
};

export type SolicitudPrecarga = {
  /** Ciclo calendario actual (ej. 23 = 2026-2027) — solicitud aplica al ciclo en curso */
  ciclo_escolar: number;
  ciclo_label: string;
  alumno: {
    id: number;
    alumno_ref: string;
    nombre_completo: string;
    alumno_app: string;
    alumno_apm: string;
    alumno_nombre: string;
    alumno_nivel: number | null;
    alumno_grado: number | null;
    alumno_grupo: string | null;
  };
  detalle: {
    alumno_calle: string | null;
    alumno_numero: string | null;
    alumno_colonia: string | null;
    alumno_cp: string | null;
  } | null;
  conceptos: ConceptoBeca[];
  mama: Familiar | null;
  papa: Familiar | null;
  solicitud: {
    id: string;
    beca_deseada_id: number | null;
    beca_porcentaje_deseado: number | null;
    tiene_otra_beca: boolean;
    otra_beca_sep: boolean; // legacy; no se expone SEP en UI
    otra_beca_pemex: boolean;
    otra_beca_empresarial: boolean;
    otra_beca_otro: boolean;
    aporta_gastos: boolean | null;
    parentesco_aportante: string | null;
    vivienda_tipo: string | null;
    motivo: string | null;
    enviado: boolean;
    enviado_en: string | null;
  } | null;
  hermanos: Hermano[];
  documentos: Documento[];
  /** true si ya envió la solicitud (enviado=true); solo consulta salvo correcciones */
  ya_registrado: boolean;
  docs_por_corregir?: boolean;
};
