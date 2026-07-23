# Formulario de solicitud de beca (nuevo ingreso) — catálogo y mapeo

> **2026-07-17** — Investigación profunda del legacy PHP (`Index2.php` → `final2.php` → `envio2.php`) y mapeo al proyecto Next/InsForge.
>
> Documento de trabajo para agentes e implementadores. Si vas a tocar UI, API o esquema de solicitud, léelo completo.

Relacionados: [`08-sistema-legacy-solicitud.md`](08-sistema-legacy-solicitud.md) (flujo legacy), [`09-solicitud-arquitectura.md`](09-solicitud-arquitectura.md) (gate/API).

---

## 1. Qué es este formulario

Es el trámite de **primera solicitud de beca** (alumno de nuevo ingreso / sin historial en `alumno_beca`), distinto de **renovación**.

| | Legacy PHP | Next (este repo) |
|--|------------|------------------|
| Entrada | `acceso.php` → clave hardcoded | Home → solicitar acceso / `?alumno_ref=` |
| Formulario | `Index2.php` (~70 campos libres) | `/solicitud` → `TabsFormularioSolicitud` |
| PDF | `final2.php` (FPDF) | `buildSolicitudPdf` + encabezado **Solicitud de Beca** (2026-07-17) |
| Documentos | PDFs en `final2` → `envio2.php` (4 legacy) | `SubirDocumentosSolicitud` → Storage (catálogo 2026-07-17 por nivel) |
| Correo | `envio2.php` SMTP | `POST /api/solicitud/finalizar` (+ acceso) |
| Persistencia BD | **Ninguna** | `becas_solicitud*` + `alumno_detalles` / `alumno_familiar` |

**Regla clave del nuevo sistema:** el alumno ya existe en `alumno`. Nombre, nivel y grado **no se capturan de nuevo**; vienen del maestro. El legacy pedía nombre/nivel/grado porque no había identidad previa.

---

## 2. Flujo legacy (referencia)

```
index.php
  → acceso.php          (POST clave)
    → Index2.php        (63 códigos hardcodeados + form datosa)
      → module/final2.php   (PDF a disco + form adjuntos)
        → module/envio2.php (SMTP + acuse)
```

Auth legacy: 63 strings en `Index2.php` (agrupados por comentario SECUNDARIA / PRIMARIA / KINDER). **Eliminados** en Next; reemplazados por `alumno_permiso_solicitud_beca` + pedido de acceso.

---

## 3. Catálogo completo de campos legacy (`Index2.php`)

Form: `id="datosa"` → `POST /becas/module/final2.php`.  
**Ningún campo del formulario principal tenía `required`.** Checkboxes sin `value` → PHP recibe `"on"`.

### 3.1 Información académica

| Label | name | tipo | Opciones / notas | ¿Va al PDF? |
|-------|------|------|------------------|-------------|
| Nivel | `Nivel` | select | 0…, 1 Maternal, 2 Kinder, 3 Primaria, 4 Secundaria | **No** (se vuelve a pedir en final2) |
| Tipo de Beca | `tbeca` | select | PEMEX, IMSS, WINSTON, PROMEDIO, DOCENCIA, EXCELENCIA, FAMILIAR, ACADEMICA, SOCIOECONOMICA, DEPORTIVA (AJEDREZ) | Sí |
| Grado | `grado` | select | Maternal…3° Sec | Sí |

### 3.2 Datos del alumno

| Label | name | tipo | ¿PDF? |
|-------|------|------|-------|
| Nombre | `nombre` | text | Sí (junto con apellidos) |
| Apellido Paterno | `appx1` | text | Sí |
| Apellido Materno | `apm` | text | Sí |

### 3.3 Dirección

| Label | name | tipo | ¿PDF? |
|-------|------|------|-------|
| Calle | `calle` | text | Sí |
| Número | `numxx` | text | Sí |
| Colonia | `colonia` | text | Sí |
| Código Postal | `CP` | text | Sí |
| Municipio | `municipio` | text | Sí |
| Estado | `estado` | text | Sí |

### 3.4 Becas actuales

| Label | name | tipo | ¿PDF? |
|-------|------|------|-------|
| SI (tiene otra beca) | `bas` | checkbox | Sí |
| NO | `ban` | checkbox | Sí |
| % DE BECA | `bap` | text | Sí |
| SEP | `sep` | checkbox | Sí |
| PEMEX | `pemex` | checkbox | Sí |
| EMPRESARIAL | `empresarial` | checkbox | Sí |
| OTRA | `otrab` | checkbox | Sí |

### 3.5 Padre / tutor (`*p`)

| Label | name | ¿PDF? |
|-------|------|-------|
| Nombre | `nomp` | Sí |
| Ocupación | `ocupacionp` | Sí |
| Empresa | `empresap` | Sí |
| Puesto | `puestop` | Sí |
| Ingreso neto mensual | `ingresop` | Sí |
| Tel. casa | `telcasap` | Sí |
| Tel. oficina | `teloficinap` | Sí |
| Celular | `telcelularp` | Sí |
| Correo | `correop` | Sí |

### 3.6 Madre (`*m`)

Misma estructura: `nomm`, `ocupacionm`, `empresam`, `puestom`, `ingresom`, `telcasam`, `teloficinam`, `telcelularm`, `correom`.

### 3.7 Información adicional

| Label | name | ¿PDF? |
|-------|------|-------|
| SI (alguien aporta gastos) | `aportas` | Sí |
| NO | `aportan` | Sí |
| Parentesco | `px` | Sí |

### 3.8 Hermanos (4 filas)

| Columna | names |
|---------|-------|
| Nombre | `n1`…`n4` |
| Edad | `e1`…`e4` |
| Estudia (institución) | `ei1`…`ei4` |
| Colegiatura mensual | `c1`…`c4` |

### 3.9 Vivienda

| Label | name |
|-------|------|
| Propia | `v1` |
| Rentada | `r1` |
| Otro | `o1` |

### 3.10 Motivo

Cuatro líneas: `m1`, `m2`, `m3`, `m4` → en PDF como MultiCell.

---

## 4. Documentos exigidos

### Legacy (`final2.php` → `envio2.php`)

Segundo formulario (sí tenían `required` + `accept="application/pdf"`):

| # | Label legacy | name file | Tipo lógico (obsoleto) |
|---|--------------|------------|------------------------|
| 1 | Comprobante(s) de ingresos de un mes (padre, madre y/o tutor) | `adjunto1` | `ingresos` |
| 2 | Comprobante de domicilio (teléfono, agua ó luz) | `adjunto2` | `domicilio` |
| 3 | Boleta SEP | `adjunto3` | `boleta` |
| 4 | Comprobante(s) de pago de inscripción completa | `adjunto4` | `comp_inscripcion` |

Además se adjuntaba el PDF generado: `solicitudes/solicitud_{nombre}.pdf`.

**Nota legacy:** “La cuota de mantenimiento y tecnología … se deberá tener cubierta al momento de realizar la inscripción.”

### Next (2026-07-17) — catálogo por trámite y nivel

Helper: `src/lib/documentos-requeridos.ts` → `docsRequeridos({ flujo, nivel, grado })`.

| `tipo` | Label UI |
|--------|----------|
| `acta_nacimiento` | Acta de nacimiento |
| `curp` | CURP del alumno |
| `curp_tutor` | CURP del papá o mamá |
| `constancia_no_adeudo` | Constancia de no adeudo |
| `carta_buena_conducta` | Carta de buena conducta |
| `boleta_interna` | Última boleta interna |

| Grupo | Criterio | Solicitud (nuevo ingreso) | Renovación (reingreso) |
|-------|----------|---------------------------|------------------------|
| Maternal / Kinder 1 | `nivel=1` o (`nivel=2` y `grado=1`) | acta, curp, curp_tutor | + `boleta_interna` |
| Kinder 2+ | resto | + constancia_no_adeudo, carta_buena_conducta | esos 5 + `boleta_interna` |

Tablas: `becas_solicitud_documento` / `becas_documento` (CHECK en los 6 slugs) + flags boolean homónimos en `becas_solicitud` / `becas_renovacion`.

---

## 5. Correo legacy (`envio2.php`)

| Nivel POST `nivel` | Destinatario To |
|--------------------|-----------------|
| 1 Maternal / 2 Kinder | `becas.kinder@winston93.edu.mx` |
| 3 Primaria | `becas.primaria@winston93.edu.mx` |
| 4 Secundaria | `becas.secundaria@winston93.edu.mx` |

- BCC: `sistemas3@winston93.edu.mx`
- From: `avisos@winston93.edu.mx`
- Subject: `SOLICITUD DE BECA`
- Adjuntos: 4 PDFs + PDF solicitud

En Next: `emailToByNivel` / `resolveBecasMailRecipients` en `src/lib/email-renovacion.ts`.  
**Prueba (2026-07-17):** To forzado a sistemas3; restaurar con `BECAS_EMAIL_USE_NIVEL=1`.

---

## 6. Mapeo legacy → Next / InsForge (estado actual)

### 6.1 Identidad y académicos

| Legacy | Destino Next | Estado |
|--------|--------------|--------|
| `nombre`+`appx1`+`apm` | `alumno.alumno_*` (solo lectura en UI) | OK — no editable |
| `Nivel` | `alumno.alumno_nivel` | OK — del maestro |
| `grado` | `alumno.alumno_grado` | OK — del maestro |
| `tbeca` | `becas_solicitud.beca_deseada_id` → `becas_concepto_beca` | OK (catálogo; id 18 = Deportiva Ajedrez) |
| `bap` (% deseado / otra) | `beca_porcentaje_deseado` | OK |

### 6.2 Domicilio

| Legacy | Destino | Estado |
|--------|---------|--------|
| `calle` | `alumno_detalles.alumno_calle` | OK |
| `numxx` | `alumno_detalles.alumno_numero` | OK |
| `colonia` | `alumno_detalles.alumno_colonia` | OK |
| `CP` | `alumno_detalles.alumno_cp` | OK |
| `municipio` / `estado` | UI fija MADERO / TAMAULIPAS (como renovación) | Parcial — no se persisten columnas propias |

### 6.3 Otras becas

| Legacy | Destino | Estado |
|--------|---------|--------|
| `bas`/`ban` | `tiene_otra_beca` | OK (boolean único) |
| `sep` | `otra_beca_sep` | OK |
| `pemex` | `otra_beca_pemex` | OK |
| `empresarial` | `otra_beca_empresarial` | OK |
| `otrab` | `otra_beca_otro` | OK |

### 6.4 Padre / Madre → `alumno_familiar`

| Legacy | Columna maestro | Estado en UI/API |
|--------|-----------------|------------------|
| `nomp` / `nomm` | `familiar_app`+`apm`+`nombre` | OK |
| `empresap/m` | `familiar_empresa_nombre` | OK |
| `puestop/m` | `familiar_empresa_puesto` | OK |
| `telcasap/m` | `familiar_tel` | OK |
| `telcelularp/m` | `familiar_cel` | OK |
| `correop/m` | `familiar_email` | OK |
| `ingresop/m` | Solo body → PDF (no BD) | OK (política privacidad) |
| `ocupacionp/m` | `familiar_escolaridad` (reuso de columna) | OK — UI + POST (2026-07-17) |
| `teloficinap/m` | `familiar_empresa_tel` | OK — UI + POST (2026-07-17) |
| (nuevo Next) ¿Vive? | `familiar_vive` | Extra vs legacy (útil) |

### 6.5 Adicional / hermanos / vivienda / motivo

| Legacy | Destino | Estado |
|--------|---------|--------|
| `aportas`/`aportan` | `aporta_gastos` | OK |
| `px` | `parentesco_aportante` | OK |
| `n*` `e*` `ei*` `c*` | `becas_solicitud_hermano` | OK |
| `v1`/`r1`/`o1` | `vivienda_tipo` (`propia`/`rentada`/`otro`) | OK |
| `m1`–`m4` | `motivo` (textarea único) | OK |

### 6.6 Documentos (2026-07-17)

| Next `tipo` | Label | Cuándo |
|-------------|-------|--------|
| `acta_nacimiento` | Acta de nacimiento | Siempre (solicitud y renovación) |
| `curp` | CURP del alumno | Siempre |
| `curp_tutor` | CURP del papá o mamá | Siempre |
| `constancia_no_adeudo` | Constancia de no adeudo | Kinder 2+ |
| `carta_buena_conducta` | Carta de buena conducta | Kinder 2+ |
| `boleta_interna` | Última boleta interna | Solo renovación |

Los 4 adjuntos legacy (`ingresos`…`comp_inscripcion`) quedaron **reemplazados**.

### 6.7 Tipos TypeScript

Payload canónico: `SolicitudPayload` / `SolicitudPrecarga` en [`src/lib/types.ts`](../src/lib/types.ts).

UI: [`TabsFormularioSolicitud.tsx`](../src/app/solicitud/components/TabsFormularioSolicitud.tsx), [`SubirDocumentosSolicitud.tsx`](../src/app/solicitud/components/SubirDocumentosSolicitud.tsx).

API: [`src/app/api/solicitud/route.ts`](../src/app/api/solicitud/route.ts), `documentos/`, `finalizar/`, `acceso/`.

---

## 7. Gaps y pendientes (para trabajar correctamente)

Prioridad restante (captura de formulario ya cubierta en lo esencial):

1. ~~**Ocupación** padre/madre~~ — **Hecho 2026-07-17** → `familiar_escolaridad`.
2. ~~**Tel. oficina** padre/madre~~ — **Hecho 2026-07-17** → `familiar_empresa_tel`.
3. ~~**Labels / catálogo de documentos**~~ — **Hecho 2026-07-17** (tipos por nivel/trámite; ver §4).
4. ~~**PDF server-side** de la solicitud~~ — **Hecho 2026-07-17** (`pdf_solicitud_key`/`url`; título «Solicitud de Beca»; ingresos solo en PDF).
5. ~~**Adjuntos en correo** de finalizar~~ — **Hecho 2026-07-17** (docs + PDF formulario + enlaces firmados).
6. **Municipio/estado** editables o persistidos si coordinación lo exige (hoy hardcodeados MADERO / TAMAULIPAS — justificado como renovación).
7. **Restaurar routing de correo por nivel** (`BECAS_EMAIL_USE_NIVEL=1`) tras pruebas a sistemas3.

No hay ETL histórico de formularios: el PHP **no insertaba** en BD.

---

## 8. Guía rápida para agentes

### Al modificar el formulario

1. Consultar §3 (catálogo legacy) y §6 (mapeo).
2. Si agregas un campo: UI → `SolicitudPayload` → POST API → columna BD (o documentar “solo PDF”).
3. No pedir de nuevo nombre/nivel/grado si ya están en `alumno` (salvo que el negocio lo cambie explícitamente).
4. Ingresos: capturar en UI, **no persistir** en BD (misma política que renovación).
5. Comentar cambios con fecha (`// 2026-07-17 - ...`).

### Al tocar documentos

- Tipos válidos: `acta_nacimiento | curp | curp_tutor | constancia_no_adeudo | carta_buena_conducta | boleta_interna`.
- Lista dinámica: `docsRequeridos({ flujo: 'solicitud' | 'renovacion', nivel, grado })`.
- No hardcodear la lista fija de 4 en UI/API.
- Finalizar debe exigir exactamente la lista de `docsRequeridos`.
- Bucket actual documentado en `docs/09` (prefijo `solicitud/`).

### Al tocar gate / acceso

- Ver `docs/09`: permiso, pedido de acceso, bloqueo si existe `alumno_beca`.
- No reintroducir códigos hardcoded.

### Diferencia crítica vs renovación

| | Solicitud nueva | Renovación |
|--|-----------------|------------|
| Tab “beca” | **Editable** (tipo deseado) | Solo lectura (beca existente) |
| Ciclo | Calendario actual | Ciclo a renovar (calendario − 1) |
| Precondición | Permiso + sin `alumno_beca` | Beca en ciclo a renovar |
| Tabla propia | `becas_solicitud*` | `becas_renovacion*` |

---

## 9. Opciones de `tbeca` legacy ↔ `becas_concepto_beca`

| Texto Index2 | beca_id (catálogo) | Notas |
|--------------|--------------------|-------|
| PEMEX | 1 | |
| IMSS | 15 | |
| WINSTON | 3 | |
| PROMEDIO | 4 | |
| DOCENCIA | 5 | |
| EXCELENCIA | 6 | |
| FAMILIAR | 7 | “Por Familia” |
| ACADEMICA | 8 | |
| SOCIOECONOMICA | 9 | |
| DEPORTIVA (AJEDREZ) | 18 | Insertado en migración solicitud |
| (otros en catálogo) | 2 SEP, 10–14, 16 CFE, 17 TELMEX | Disponibles en select Next aunque no estaban en Index2 |

El select Next usa **todo** `becas_concepto_beca`, no solo las 10 opciones del legacy (mejora aceptada).

---

## 10. Checklist de aceptación del formulario

Un agente puede dar por “completo a nivel captura” cuando:

- [x] Todos los campos de §3.2–3.10 tienen destino en UI o justificación de exclusión (identidad del maestro).
- [x] Ocupación y tel. oficina existen.
- [x] Documentos dinámicos por nivel con labels claros y `required` en flujo.
- [x] POST persiste en `becas_solicitud` + familiares + detalles + hermanos.
- [x] Gate de permiso y anti-`alumno_beca` activo.
- [x] Correo de finalizar con adjuntos PDF (docs + formulario) + enlaces firmados.
- [x] PDF de formulario de solicitud en Storage (encabezado «Solicitud de Beca»).
