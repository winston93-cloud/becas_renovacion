# Pendientes y alcance futuro

Este documento existe para que un agente de IA no re-descubra desde cero decisiones ya tomadas conscientemente, y para que sepa qué es "falta por hacer" vs. "se decidió no hacerlo (todavía)".

## Implementado (2026-07-17): Solicitud de beca por primera vez

Migrado al mismo proyecto Next/InsForge. Ver:

- `docs/08-sistema-legacy-solicitud.md` — auditoría del PHP
- `docs/09-solicitud-arquitectura.md` — gate, tablas, API, UI
- `docs/10-formulario-solicitud-campos.md` — **catálogo Index2 + mapeo + gaps** (lectura obligatoria al tocar el form)

Resumen: flags `alumno_permiso_solicitud_beca` + `alumno_solicitud_acceso_enviada`, tablas `becas_solicitud*`, rutas `/solicitud` y `/api/solicitud*`. Pedido de acceso desde el home antes del formulario.

### Pendiente dentro de solicitud

- **Paridad de campos** vs Index2: ocupación y tel. oficina padre/madre (ver `docs/10` §7).
- **Labels de documentos** alineados al texto largo de `final2.php`.
- **Correo SMTP acceso / finalizar:** **Hecho (2026-07-17)** — `POST /api/solicitud/acceso` y `POST /api/solicitud/finalizar`. To por nivel + BCC sistemas3.
- **Panel admin** para activar `alumno_permiso_solicitud_beca` (en el panel de becas aún no migrado).
- **PDF de solicitud nueva** generado server-side + Storage — **Hecho 2026-07-17** (encabezado «Solicitud de Beca»; renovación «Renovación de Beca»).
- **Adjuntos** en el correo de solicitud nueva (patrón renovación / `envio2.php`).

## Explícitamente fuera de alcance (a propósito)

- **Panel administrativo/coordinador** equivalente a `index_becas.html` (autorizar becas, marcar `verificado`, `beca_autorizada`, generar reportes/Excel). Las columnas ya existen en `becas_renovacion` y `becas_solicitud` previendo esto, pero no hay UI ni API para administrarlas todavía.

## Pendiente, no implementado aún (dentro del alcance de renovación)

### Destinatarios de correo por nivel escolar

**Hecho (2026-07-16):** routing por `alumno_nivel` (kinder / primaria / secundaria) + BCC sistemas3.

**Prueba (2026-07-17):** To forzado a `sistemas3@winston93.edu.mx` (`BECAS_EMAIL_TO`). Si To === BCC, se omite BCC. Restaurar producción con `BECAS_EMAIL_USE_NIVEL=1`.

| Nivel | Destinatario (cuando `BECAS_EMAIL_USE_NIVEL=1`) |
|---|---|
| 1 Maternal, 2 Kinder | `becas.kinder@winston93.edu.mx` |
| 3 Primaria | `becas.primaria@winston93.edu.mx` |
| 4 Secundaria | `becas.secundaria@winston93.edu.mx` |

Helpers: `emailToByNivel` / `emailBccSistemas` / `resolveBecasMailRecipients` en `src/lib/email-renovacion.ts`.

### Documentos por nivel / trámite

**Hecho (2026-07-17):** catálogo nuevo (`acta_nacimiento`, `curp`, …) vía `docsRequeridos`. Ver `docs/04`, `docs/09`, `docs/10`.

### Política de privacidad: ingresos de padres

**Hecho (2026-07-16):** `ingreso_mensual_padre` / `ingreso_mensual_madre` se capturan en el formulario y se imprimen en el PDF de solicitud, pero **siempre se guardan `null` en BD** (columnas se mantienen sin DROP). El GET los expone como `null`; al finalizar se adjunta el PDF ya guardado en Storage. Ver `docs/03` y `docs/04`.

### Generación de PDF de la solicitud y comprobante

**Hecho (2026-07-16):**

- Solicitud completa (carta) en `src/lib/pdf/solicitud.ts` al **POST /api/renovacion** (con sueldos del body), adjunto al correo desde `pdf_solicitud_key` y Storage.
- Comprobante con QR en `src/lib/pdf/comprobante.ts` + `GET /api/renovacion/comprobante` y botón en `ResumenConfirmacion`.

### Seguridad del enlace `alumno_ref`

Documentado en `docs/02-arquitectura-nueva.md`: hoy cualquiera con la URL exacta puede ver los datos de ese alumno (no hay contraseña ni token). Se decidió así porque el usuario pidió explícitamente identificación por query param sin volver a pedir contraseña. Si el requerimiento de seguridad sube, opciones a evaluar (no implementadas):

- Token firmado de corta duración generado por el sistema PHP viejo al construir el enlace (ej. JWT con `alumno_ref` + expiración, verificado en el Route Handler antes de consultar InsForge).
- Autenticación real de InsForge (`@insforge/sdk` Auth) si se quiere que el padre tenga una cuenta persistente en vez de un enlace de un solo uso.

### Validación de cliente para "ingreso mensual obligatorio si vive"

Actualmente solo se valida en el servidor (`POST /api/renovacion`). Funciona, pero el usuario solo ve el error después de intentar guardar. Se puede añadir validación optimista en `TabsFormulario.tsx` sin quitar la validación de servidor.

### Migración de datos históricos de `becasr`/`obs_becas`

Ver `docs/06-migracion-datos.md`, sección "Qué falta migrar" — requiere decisión manual caso por caso por el bug histórico de doble fuente en el legacy, no se automatizó.

### Subida de PDFs históricos ya almacenados en disco en el hosting PHP

No migrados a InsForge Storage. Ver `docs/06-migracion-datos.md`.

## Cómo retomar el trabajo

1. Lee `AGENTS.md` y esta carpeta `docs/` completa antes de escribir código.
2. Si el pendiente que vas a resolver toca esquema de base de datos, crea una migración nueva (`npx @insforge/cli db migrations new <nombre>`) — nunca edites migraciones ya aplicadas.
3. El correo de solicitud nueva ya usa `src/lib/mailer.ts` + `emailToByNivel` (ver `src/app/api/solicitud/finalizar/route.ts`).
