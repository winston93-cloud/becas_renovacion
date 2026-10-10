/**
 * 2026-10-08 - Beca SEP: aviso de "Listo" después de aplicar o regresar un trámite, con lo que falta.
 */
import { Alert } from '@/components/ui';

export function AvisoListo({ hecho, de, pendientes }: { hecho?: string; de?: string; pendientes: number }) {
  if (hecho !== 'aplicada' && hecho !== 'correccion') return null;
  const quien = de ? ` de ${de}` : '';
  const titulo = hecho === 'aplicada' ? `Listo: se aplicó la beca${quien}.` : `Listo: se le pidió otro documento a la familia${quien}.`;
  return (
    <Alert variant="success" title={titulo}>
      {pendientes === 0
        ? 'Ya no quedan documentos por revisar.'
        : `${pendientes === 1 ? 'Queda 1 documento' : `Quedan ${pendientes} documentos`} por revisar.`}
    </Alert>
  );
}
