# Contrato de la API (Route Handlers)

Todas las rutas viven en `src/app/api/` y corren **solo en servidor**, usando `getInsforgeAdmin()` (`src/lib/insforge-server.ts`).

## `GET /api/renovacion?alumno_ref=<No.Control>`

Precarga toda la información necesaria para el formulario.

`alumno_ref` se parsea a **número** (en BD es integer).

### Validaciones, en orden

1. `alumno_ref` presente y numérico → si no, `400`.
2. Existe `alumno` con ese `alumno_ref` y `alumno_status != 0` → si no, `404`.
3. Existe `alumno_beca` con `beca_estatus = 0` (beca desactivada del ciclo cerrado) y `beca_ciclo_escolar = ciclo a renovar` (`getCicloBecaARenovar()` = calendario − 1, ej. 22) → si no, `403` con mensaje amigable. El home valida esto **antes** de navegar a `/renovacion`.
4. Lookup de nombre/promedio en `becas_concepto_beca` por `beca_id`.
5. Carga `alumno_detalles`, `alumno_familiar`, y si existe `becas_renovacion` del mismo ciclo a renovar.

### Response `200` (cambios clave)

- `alumno.id` es **number** (`alumno_id` entero), no uuid.
- `alumno.alumno_ref` se serializa como string para la UI.
- `ya_registrado: boolean` — `true` si `becas_renovacion.correo_enviado` en el ciclo a renovar. El frontend debe ir directo al comprobante y no permitir reeditar.
- `renovacion.correo_enviado` / `correo_enviado_en` cuando aplica.

### Response `200`

```ts
type RenovacionPrecarga = {
  ciclo_escolar: number;
  ciclo_label: string;              // ej. "2026 - 2027"
  alumno: {
    id: string; alumno_ref: string; nombre_completo: string;
    alumno_app: string; alumno_apm: string; alumno_nombre: string;
    alumno_nivel: number | null; alumno_grado: number | null; alumno_grupo: string | null;
  };
  detalle: { alumno_calle, alumno_numero, alumno_colonia, alumno_cp } | null;
  beca: { beca_id: number; beca_clase: string; beca_porcentaje: number; beca_promedio_requerido: number };
  mama: Familiar;   // tutor_id=1, objeto vacío si no existe fila aún
  papa: Familiar;   // tutor_id=2, objeto vacío si no existe fila aún
  renovacion: { id, ingreso_mensual_padre, ingreso_mensual_madre, motivo, casa_tipo, otra_beca, otra_beca_porcentaje, observaciones } | null;
  // ingreso_mensual_* siempre null en la respuesta (no se persisten; solo van al PDF al POST)
  hermanos: Hermano[];       // array de hasta 4, vacío si no hay renovación previa
  documentos: Documento[];   // documentos ya subidos en esta renovación
};
```

Ver definiciones completas en `src/lib/types.ts`.

### Errores

| Status | Causa |
|---|---|
| 400 | Falta `alumno_ref` |
| 404 | No existe alumno activo con ese `alumno_ref` |
| 403 | Alumno existe pero no tiene beca activa en el ciclo vigente |
| 500 | Error de InsForge / excepción no controlada |

## `POST /api/renovacion`

Guarda/actualiza la renovación del ciclo vigente para un alumno. Es **idempotente por ciclo**: llamar dos veces con el mismo `alumno_id` actualiza la misma fila (`UNIQUE (alumno_id, ciclo_escolar)`).

### Request body (`RenovacionPayload`, ver `src/lib/types.ts`)

```ts
{
  alumno_id: number;                 // alumno.alumno_id entero (NO uuid)
  ingreso_mensual_padre: number | null;
  ingreso_mensual_madre: number | null;
  motivo: string;                    // obligatorio, 5-500 caracteres
  casa_tipo: string;
  otra_beca: boolean;
  otra_beca_porcentaje: number | null;
  observaciones: string;
  detalle: { alumno_calle, alumno_numero, alumno_colonia, alumno_cp };
  mama: Partial<Familiar>;           // tutor_id se fuerza a 1 en el servidor
  papa: Partial<Familiar>;           // tutor_id se fuerza a 2 en el servidor
  hermanos: Hermano[];               // hasta 4, se filtran los que no tengan nombre
}
```

### Validaciones de negocio (replican las reglas JS del legacy `index1.php`)

1. `motivo` obligatorio, entre 5 y 500 caracteres → si no, `400`.
2. Si `mama.familiar_vive === true`, `ingreso_mensual_madre` es obligatorio y > 0 → si no, `400` (solo para el PDF; **no se persiste**).
3. Si `papa.familiar_vive === true`, `ingreso_mensual_padre` es obligatorio y > 0 → si no, `400` (igual).

### Qué hace internamente (orden de operaciones)

1. Upsert de `alumno_detalles` (domicilio) por `alumno_id` / `detalle_id`.
2. Upsert de `alumno_familiar` para `tutor_id=1` (mamá) y `tutor_id=2` (papá) vía `familiar_id`.
3. Upsert de `becas_renovacion` por `(alumno_id integer, ciclo_escolar)`, con `ingreso_mensual_padre/madre = null`, `solicitud = true`.
4. **Borra y reinserta** todos los `becas_hermano` de esa renovación.
5. Genera el **PDF de solicitud** con los ingresos del body (no guardados), lo sube a Storage y guarda `pdf_solicitud_key` / `pdf_solicitud_url`.

### Response `200`

```json
{ "success": true, "renovacion_id": "<uuid>", "ciclo_escolar": 23, "message": "Renovación guardada correctamente." }
```

El frontend usa `renovacion_id` para avanzar al paso de subida de documentos.

Si `correo_enviado` ya es true → `409` con `{ ya_registrado: true }` (no se permite reeditar).

**Política ingresos (2026-07-16):** el payload puede traer `ingreso_mensual_*` para el PDF; en BD siempre quedan `null`. El GET siempre los devuelve `null`.

## `POST /api/renovacion/documentos`

Sube un PDF al bucket privado `becas-documentos` y registra/actualiza la fila en `becas_documento`. Multipart form-data.

### Campos del form

| Campo | Tipo | Notas |
|---|---|---|
| `renovacion_id` | string (uuid) | debe existir en `becas_renovacion` |
| `tipo` | string | uno de `acta_nacimiento`, `curp`, `curp_tutor`, `constancia_no_adeudo`, `carta_buena_conducta`, `boleta_interna` |
| `file` | File | debe ser `application/pdf`, máximo 10 MB |

### Qué hace internamente

1. Valida `renovacion_id`, `tipo` y el archivo (tipo MIME y tamaño).
2. Sube el archivo a `becas-documentos` con una key `<alumno_id>/<renovacion_id>/<tipo>-<timestamp>-<nombre-sanitizado>`.
3. Si ya existía un documento de ese `tipo` para esa renovación, **borra el objeto anterior en Storage** y actualiza la fila; si no, inserta una nueva.
4. Marca el flag boolean homónimo en `becas_renovacion` (p. ej. `acta_nacimiento` → columna `acta_nacimiento`).

### Response `200`

```json
{ "success": true, "documento_id": "<uuid>", "tipo": "acta_nacimiento", "storage_key": "...", "storage_url": "...", "message": "Documento acta_nacimiento subido correctamente." }
```

### Errores

| Status | Causa |
|---|---|
| 400 | Falta `renovacion_id`/`tipo`/`file`, tipo inválido, archivo no es PDF, o excede 10 MB |
| 404 | `renovacion_id` no existe |
| 409 | Renovación ya finalizada (`correo_enviado`) |
| 500 | Error al subir a Storage o a la base de datos |

## `POST /api/renovacion/finalizar`

Envía el correo de notificación al completar la renovación (**Nodemailer + SMTP**) y marca `correo_enviado` en `becas_renovacion`.

### Body JSON

```json
{ "renovacion_id": "<uuid>" }
```

Query opcional: `?force=1` para reenviar aunque ya exista `correo_enviado`.

### Qué hace internamente

1. Calcula docs requeridos con `docsRequeridos({ flujo: 'renovacion', nivel, grado })` y valida que existan.
2. Exige `pdf_solicitud_key` (PDF generado al guardar el formulario; si falta → `400`).
3. Descarga esos PDFs del usuario + el PDF de solicitud desde Storage y los **adjunta** al correo.
4. Genera también URLs firmadas HMAC (7 días) de respaldo.
5. Envía vía SMTP (ver destinatarios abajo).
6. Actualiza `correo_enviado`, `correo_enviado_en`, `correo_id`, `solicitud=true` y reafirma ingresos en `null`.

### Documentos requeridos (2026-07-17)

Helper: `src/lib/documentos-requeridos.ts`.

| Grupo | Criterio | Docs (renovación = reingreso) |
|---|---|---|
| Maternal / Kinder 1 | `nivel=1` o (`nivel=2` y `grado=1`) | `acta_nacimiento`, `curp`, `curp_tutor`, `boleta_interna` |
| Kinder 2+ | resto | esos 3 + `constancia_no_adeudo`, `carta_buena_conducta`, `boleta_interna` |

### Destinatarios de correo

**Producción (default, 2026-07-22):** To según nivel escolar. BCC = `sistemas3@winston93.edu.mx`.

| Nivel | Destinatario (`to`) |
|---|---|
| 1 Maternal, 2 Kinder | `becas.kinder@winston93.edu.mx` |
| 3 Primaria | `becas.primaria@winston93.edu.mx` |
| 4 Secundaria | `becas.secundaria@winston93.edu.mx` |

**Prueba:** `BECAS_EMAIL_FORCE_TEST=1` fuerza To = `BECAS_EMAIL_TO` (default sistemas3); si To === BCC se omite BCC. Nivel null/inválido → `400`.

### Response `200`

```json
{ "success": true, "email_id": "...", "message": "Renovación finalizada y correo enviado." }
```

Si ya se había enviado (sin `force`): `{ "success": true, "already_sent": true, ... }`.

### Errores

| Status | Causa |
|---|---|
| 400 | Falta `renovacion_id`, faltan documentos, o nivel escolar inválido |
| 404 | Renovación o alumno no existe |
| 502 | Fallo SMTP (credenciales, puerto bloqueado, servidor caído) |
| 500 | Error de entorno (`SMTP_*`, `BECAS_DOC_LINK_SECRET`) o base de datos |

### Variables de entorno

| Variable | Uso |
|---|---|
| `BECAS_EMAIL_FORCE_TEST` | `1` = forzar To de prueba (no usar en Vercel Production) |
| `BECAS_EMAIL_TO` | To en modo prueba (default sistemas3) |
| `BECAS_EMAIL_KINDER` | Override To maternal/kinder (default `becas.kinder@…`) |
| `BECAS_EMAIL_PRIMARIA` | Override To primaria |
| `BECAS_EMAIL_SECUNDARIA` | Override To secundaria |
| `BECAS_EMAIL_BCC` | Copia oculta (default `sistemas3@winston93.edu.mx`) |
| `BECAS_EMAIL_REPLY_TO` | Reply-To opcional (default = To del nivel) |
| `BECAS_DOC_LINK_SECRET` | Secreto HMAC (≥16 chars) para links de descarga |
| `SMTP_HOST` | Ej. `mail.winston93.edu.mx` |
| `SMTP_PORT` | `25` (local legacy) o `587`/`465` (recomendado en Vercel) |
| `SMTP_SECURE` | `true` solo con 465 |
| `SMTP_USER` / `SMTP_PASS` | Credenciales SMTP |
| `SMTP_FROM` / `SMTP_FROM_NAME` | Remitente |

**Nota Vercel:** el puerto 25 suele estar bloqueado; prueba `SMTP_PORT=587`.

## `GET /api/renovacion/documentos/download?token=…`

Sirve el PDF si el token HMAC es válido y no ha expirado. Usado solo desde los enlaces del correo.

## `GET /api/renovacion/comprobante?renovacion_id=…`

Genera on-the-fly el **comprobante de registro** (carta): nombre, grado, grupo, fecha, QR con No. de Control. Requiere renovación finalizada (correo enviado o checklist de 4 docs).

### Response `200`

`Content-Type: application/pdf` + attachment `comprobante-beca-{alumno_ref}.pdf`.

### Errores

| Status | Causa |
|---|---|
| 400 | Falta `renovacion_id` o renovación incompleta |
| 404 | Renovación o alumno no existe |
| 500 | Error al generar PDF |

## Notas para extender la API

- Si agregas un nuevo campo al formulario, actualízalo en 3 lugares a la vez: `src/lib/types.ts` (tipo), el Route Handler (`route.ts`, tanto GET como POST si aplica), y el componente de formulario correspondiente.
- Cualquier nueva ruta que toque las tablas `becas_*` debe usar `getInsforgeAdmin()`, nunca un cliente con `anonKey` — esas tablas no tienen permisos para `anon`/`authenticated`.
- Si se agrega autenticación real (ver doc 07), la validación de "quién puede ver este `alumno_ref`" debe añadirse en `GET /api/renovacion` antes de la consulta a base de datos, no después.
