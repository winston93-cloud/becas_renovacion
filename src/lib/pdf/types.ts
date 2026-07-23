/**
 * 2026-07-16 - Tipos de datos para generación de PDFs de renovación.
 */

export type PdfFamiliar = {
  nombre: string;
  vive: string;
  ingresoMensual: string;
  empresa: string;
  puesto: string;
  tel: string;
  cel: string;
  email: string;
};

export type PdfHermano = {
  orden: number;
  nombre: string;
  edad: string;
  institucion: string;
  colegiatura: string;
};

export type PdfSolicitudData = {
  alumnoNombre: string;
  alumnoRef: string;
  nivelLabel: string;
  grado: string;
  grupo: string;
  cicloLabel: string;
  becaClase: string;
  becaPorcentaje: string;
  promedioRequerido: string;
  domicilio: {
    calle: string;
    numero: string;
    colonia: string;
    cp: string;
    municipio: string;
    estado: string;
  };
  papa: PdfFamiliar;
  mama: PdfFamiliar;
  otraBeca: string;
  otraBecaPct: string;
  casaTipo: string;
  motivo: string;
  observaciones: string;
  hermanos: PdfHermano[];
  fechaGeneracion: string;
};

export type PdfComprobanteData = {
  alumnoNombre: string;
  alumnoRef: string;
  grado: string;
  grupo: string;
  cicloLabel: string;
  fechaRegistro: string;
};
