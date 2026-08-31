// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

/** Detecta si hubo cambio real de tipo o porcentaje en una beca ya autorizada. */
export function huboCambioBecaAutorizada(detalle: {
  beca_id_anterior: number | null;
  beca_id_nuevo: number;
  porcentaje_anterior: number | null;
  porcentaje_nuevo: number;
  beca_autorizada: boolean;
}): boolean {
  if (!detalle.beca_autorizada) return false;
  const tipoCambio = Number(detalle.beca_id_anterior) !== Number(detalle.beca_id_nuevo);
  const pctCambio =
    Number(detalle.porcentaje_anterior) !== Number(detalle.porcentaje_nuevo);
  return tipoCambio || pctCambio;
}

export async function resolverClasesBeca(
  db: Db,
  becaIds: Array<number | null | undefined>
): Promise<Map<number, string>> {
  const ids = [...new Set(becaIds.filter((id): id is number => Number(id) > 0))];
  const map = new Map<number, string>();
  if (!ids.length) return map;

  const { data, error } = await db
    .from('becas_concepto_beca')
    .select('beca_id, beca_clase')
    .in('beca_id', ids);

  if (error) return map;
  for (const row of (data || []) as Array<{ beca_id: number; beca_clase: string }>) {
    map.set(Number(row.beca_id), String(row.beca_clase));
  }
  return map;
}
