# Arquitectura — Solicitud de beca (nuevo ingreso)

Implementado 2026-07-17 en el mismo proyecto Next.js/InsForge que renovación.

> **Formulario campo a campo (legacy ↔ Next):** [`10-formulario-solicitud-campos.md`](10-formulario-solicitud-campos.md).

## Reglas de negocio (gate)

### Solicitar acceso (home)

1. Alumno activo existe.
2. **No** tiene filas en `alumno_beca` (si las tiene → usar renovación).
3. Si `alumno_permiso_solicitud_beca = 1` → puede ir al formulario.
4. Si ya tiene `alumno_solicitud_acceso_enviada = 1` y aún sin permiso → mensaje de espera (no reenvía correo).
5. Si no ha pedido acceso → `POST /api/solicitud/acceso` envía correo por nivel + BCC y marca el flag.
6. Si existe **cualquier** fila en `alumno_beca` (activa o no) → el home muestra un **modal**: el trámite correcto es Renovación, no Solicitud nueva.

### Formulario (`GET/POST /api/solicitud`)

1. El alumno existe y `alumno_status ≠ 0`.
2. `alumno.alumno_permiso_solicitud_beca = 1` (activado por staff tras el pedido de acceso).
3. **No** existe ninguna fila en `alumno_beca` para ese `alumno_id`.
4. Identificación por `?alumno_ref=`.
5. Ciclo: `getCurrentSchoolCycle()` (calendario actual), **no** el ciclo a renovar.

Códigos de error:

| HTTP | codigo | Significado |
|------|--------|------------|
| 404 | — | Alumno no encontrado / inactivo |
| 403 | `NO_AUTORIZADO` | Sin permiso de solicitud |
| 403 | `YA_TIENE_BECA` | Ya tiene registro en `alumno_beca` |
| 409 | — | Ya envió solicitud (`enviado=true`) |

## Tablas

### Columnas en maestro `alumno`

```sql
alumno.alumno_permiso_solicitud_beca smallint NOT NULL DEFAULT 0
alumno.alumno_solicitud_acceso_enviada smallint NOT NULL DEFAULT 0
alumno.alumno_solicitud_acceso_en timestamptz
```

- `…_acceso_enviada = 1`: ya pidió acceso (correo enviado); el portal muestra “espere respuesta”.
- `…_permiso_solicitud_beca = 1`: staff autorizó; puede llenar el formulario.

Activar un alumno de prueba (después del pedido de acceso):

```sql
UPDATE alumno SET alumno_permiso_solicitud_beca = 1
WHERE alumno_ref = <no_control>
  AND NOT EXISTS (
    SELECT 1 FROM alumno_beca b WHERE b.alumno_id = alumno.alumno_id
  );
```

### Tablas propias (prefijo `becas_`)

| Tabla | Rol |
|-------|-----|
| `becas_solicitud` | Una fila por alumno/ciclo: beca deseada, otras becas, vivienda, motivo, checklist docs, `enviado` |
| `becas_solicitud_hermano` | Hasta 4 hermanos |
| `becas_solicitud_documento` | PDFs en Storage (tipos: `acta_nacimiento`, `curp`, `curp_tutor`, `constancia_no_adeudo`, `carta_buena_conducta`, `boleta_interna`; set según nivel) |

Domicilio y padres se upsertan en `alumno_detalles` / `alumno_familiar` (maestro compartido).

Catálogo: `becas_concepto_beca` incluye `beca_id=18` Deportiva (Ajedrez).

Todas las tablas `becas_solicitud*` tienen `REVOKE ALL` para `anon`/`authenticated`.

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/solicitud/acceso?alumno_ref=` | Estado: puede_solicitar / esperando_respuesta / autorizado / ya_tiene_beca |
| POST | `/api/solicitud/acceso` | Envía correo de acceso (prueba → sistemas3); marca `alumno_solicitud_acceso_enviada` |
| GET | `/api/solicitud?alumno_ref=` | Precarga + gate (requiere permiso) |
| POST | `/api/solicitud` | Guarda formulario + genera PDF (`pdf_solicitud_key`; encabezado **Solicitud de Beca**) |
| POST | `/api/solicitud/documentos` | Sube un PDF (FormData: `solicitud_id`, `tipo`, `file`) |
| POST | `/api/solicitud/finalizar` | Exige docs + PDF formulario; correo con adjuntos + enlaces; marca `enviado=true` |
| GET | `/api/solicitud/documentos/download?token=` | Descarga PDF con token HMAC (7 días) |

Storage: bucket `becas-documentos`, keys con prefijo `solicitud/{alumno_id}/{solicitud_id}/...`.

### Documentos por nivel (2026-07-17)

Helper compartido: `docsRequeridos` en `src/lib/documentos-requeridos.ts`.

| Flujo | Maternal / Kinder 1 | Kinder 2+ |
|-------|---------------------|-----------|
| Solicitud (nuevo ingreso) | acta, curp, curp_tutor | + constancia_no_adeudo, carta_buena_conducta |
| Renovación (reingreso) | esos 3 + boleta_interna | los 5 + boleta_interna |

### Correos SMTP (2026-07-17)

| Momento | Template | Destino |
|---------|----------|---------|
| Solicitar acceso | `buildSolicitudAccesoEmail*` | Prueba: To sistemas3 (sin BCC duplicado). Producción: `BECAS_EMAIL_USE_NIVEL=1` |
| Finalizar expediente | `buildSolicitudEmail*` | Igual |

Niveles (cuando se reactive): 1–2 → `becas.kinder@…`; 3 → primaria; 4 → secundaria.

## Frontend

| Ruta / componente | Rol |
|-------------------|-----|
| `/` (home) | Renovación → Continuar; Solicitud → **Solicitar acceso** / espera / formulario si autorizado; header `Portal de Becas` |
| `/solicitud?alumno_ref=` | Orquestador (form → docs → acuse) — solo con permiso; header **`Solicitud de Beca`** |
| `TabsFormularioSolicitud` | Tabs: Beca deseada (editable), Alumno, Padre, Madre, Adicional — distinto del tab de renovación (solo lectura) |
| `SubirDocumentosSolicitud` | PDFs dinámicos (`docsRequeridos`) + finalizar |
| `ResumenConfirmacionSolicitud` | Acuse |

**Identidad visual (2026-07-17):** el shell (`AppHeader.titulo`) debe nombrar el trámite; no reutilizar el título de renovación en `/solicitud`.

## Pendiente explícito

- Panel admin para activar `alumno_permiso_solicitud_beca` masivamente.
- Restaurar routing de correo por nivel (`BECAS_EMAIL_USE_NIVEL=1`) tras pruebas.

### PDF de formulario y correo (2026-07-17)

- Al guardar (`POST /api/solicitud`): `buildSolicitudPdf(..., { title: 'Solicitud de Beca' })` → Storage + columnas `pdf_solicitud_key` / `pdf_solicitud_url`.
- Renovación usa el mismo generador con título **Renovación de Beca**; pie compartido **Portal de Becas**.
- Finalizar adjunta docs de usuario + `solicitud-beca-{ref}.pdf` y enlaces firmados.

Ver `docs/07-pendientes-y-alcance-futuro.md`.
