import { Badge } from '@/components/ui';
import type { FirmaListaResumen } from '@/lib/firma-electronica-estado';

export type AdminListaEstadoItem = {
  verificado: boolean;
  beca_autorizada: boolean;
  correo_enviado?: boolean;
  enviado?: boolean;
  firma_electronica?: FirmaListaResumen | null;
};

export function isBecaActivadaLista(
  firma: FirmaListaResumen | null | undefined
): boolean {
  return Boolean(firma?.beca_activada);
}

export function isEsperandoFirmaLista(
  item: AdminListaEstadoItem
): boolean {
  const firma = item.firma_electronica;
  return Boolean(
    item.beca_autorizada && firma?.activo && !firma.beca_activada
  );
}

export function adminListaRowActivadaClass(
  firma: FirmaListaResumen | null | undefined
): string {
  return isBecaActivadaLista(firma) ? 'admin-table-row--activada' : '';
}

export function adminListaCardActivadaClass(
  firma: FirmaListaResumen | null | undefined
): string {
  return isBecaActivadaLista(firma) ? 'admin-mobile-card--activada' : '';
}

type AdminListaEstadoCeldaProps = AdminListaEstadoItem & {
  esCorreccionDocs?: boolean;
  docs_incorrectos_count?: number;
  layout?: 'table' | 'card';
};

export function AdminListaEstadoCelda({
  verificado,
  beca_autorizada,
  correo_enviado,
  enviado,
  firma_electronica,
  esCorreccionDocs = false,
  docs_incorrectos_count = 0,
  layout = 'table',
}: AdminListaEstadoCeldaProps) {
  const activada = isBecaActivadaLista(firma_electronica);
  const esperandoFirma = isEsperandoFirmaLista({
    verificado,
    beca_autorizada,
    correo_enviado,
    enviado,
    firma_electronica,
  });
  const enviadoFlag = correo_enviado ?? enviado ?? false;

  return (
    <div
      className={
        layout === 'table'
          ? 'admin-lista-estado admin-lista-estado--table'
          : 'admin-lista-estado admin-lista-estado--card'
      }
    >
      <div className="admin-lista-estado__badges">
        {activada ? (
          <span className="admin-badge-activada" title="Carta firmada y beca activada">
            ✓ Firmada y activada
          </span>
        ) : null}

        {verificado ? (
          <Badge variant="success">Verificada</Badge>
        ) : esCorreccionDocs || docs_incorrectos_count > 0 ? (
          <Badge variant="pending">
            {layout === 'card' ? 'Docs incorrectos' : 'Esperando corrección'}
          </Badge>
        ) : enviadoFlag ? (
          <Badge variant="pending">Pendiente</Badge>
        ) : (
          <Badge variant="neutral">Borrador</Badge>
        )}

        {beca_autorizada ? (
          <Badge
            variant="success"
            className={
              activada
                ? '!border-emerald-700 !bg-emerald-50 !font-semibold !text-emerald-900'
                : '!border-emerald-600 !bg-emerald-600 !font-bold !text-white'
            }
          >
            {activada ? 'Autorizada' : '✓ Autorizada'}
          </Badge>
        ) : null}

        {esperandoFirma ? (
          <Badge
            variant="pending"
            className="!border-amber-500 !bg-amber-50 !font-semibold !text-amber-900"
          >
            Esperando firma
          </Badge>
        ) : null}
      </div>

      {activada && firma_electronica?.firmado_por ? (
        <p className="admin-lista-estado__firmante" title="Quién firmó la carta">
          <span className="admin-lista-estado__firmante-label">Firmó:</span>{' '}
          {firma_electronica.firmado_por}
        </p>
      ) : null}
    </div>
  );
}
