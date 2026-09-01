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
        {!verificado ? (
          esCorreccionDocs || docs_incorrectos_count > 0 ? (
            <span className="admin-badge-estado admin-badge-estado--correccion">
              {layout === 'card' ? 'Docs incorrectos' : 'Esperando corrección'}
            </span>
          ) : enviadoFlag ? (
            <span className="admin-badge-estado admin-badge-estado--pendiente">
              Pendiente
            </span>
          ) : (
            <span className="admin-badge-estado admin-badge-estado--borrador">
              Borrador
            </span>
          )
        ) : null}

        {verificado ? (
          <span className="admin-badge-estado admin-badge-estado--verificada">
            Verificada
          </span>
        ) : null}

        {beca_autorizada ? (
          <span className="admin-badge-estado admin-badge-estado--autorizada">
            ✓ Autorizada
          </span>
        ) : null}

        {activada ? (
          <span
            className="admin-badge-estado admin-badge-estado--activada"
            title="Carta firmada y beca activada"
          >
            ✓ Firmada y activada
          </span>
        ) : esperandoFirma ? (
          <span className="admin-badge-estado admin-badge-estado--espera-firma">
            Esperando firma
          </span>
        ) : null}
      </div>

      {activada && firma_electronica?.firmado_por ? (
        <p className="admin-lista-estado__firmante" title="Quién firmó la carta">
          <span className="admin-lista-estado__firmante-label">Firmó:</span>{' '}
          <span className="admin-lista-estado__firmante-nombre">
            {firma_electronica.firmado_por}
          </span>
        </p>
      ) : null}
    </div>
  );
}
