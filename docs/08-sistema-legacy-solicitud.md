# Sistema legacy PHP — Solicitud de beca (nuevo ingreso)

Auditoría del flujo de **solicitud de beca por primera vez** en el sistema PHP legacy (`c:\Users\rafas\Desktop\becas`). Fecha: 2026-07-17.

> **Catálogo completo de campos + mapeo Next:** ver [`10-formulario-solicitud-campos.md`](10-formulario-solicitud-campos.md) (documento de trabajo principal para el formulario).

## Flujo

```
index.php (portal)
  └─ acceso.php          → pide "clave de acceso"
       └─ Index2.php     → 63 strings hardcodeados + formulario libre (~70 campos)
            └─ module/final2.php   → PDF FPDF (b1.jpg/b2.jpg), NO BD
                 └─ module/envio2.php → SMTP + 4 PDFs + PDF solicitud
```

## Auth (eliminada en la migración)

- Validación real en `Index2.php`: 63 códigos `XXXX-XXXX-XXXX-XXXX` (comentarios SECUNDARIA / PRIMARIA / KINDER).
- `acceso.php` tiene código muerto (`password` / `"12345"`) que no participa.
- Cero consultas a BD. Sin flag de permiso en `alumno`.

Lista completa de códigos: documentada en la auditoría de investigación (no reutilizar en Next).

## Persistencia legacy

| Paso | Persistencia |
|------|--------------|
| Index2 | Ninguna |
| final2 | PDF en `module/solicitudes/solicitud_{nombre}.pdf` + sesión |
| envio2 | Correo SMTP; no INSERT |

**No usa** `alumno`, `alumno_beca`, `alumno_detalles`, `alumno_familiar`.

## Campos (resumen)

Ver tabla exhaustiva en [`docs/10`](10-formulario-solicitud-campos.md) §3.

Secciones: académicos (`Nivel`, `tbeca`, `grado`) · alumno · dirección · becas actuales · padre · madre · aportaciones · hermanos (4) · vivienda · motivo (`m1`–`m4`).

## Documentos (final2)

1. Ingresos (`adjunto1`)  
2. Domicilio (`adjunto2`)  
3. Boleta SEP (`adjunto3`)  
4. Comprobante inscripción (`adjunto4`)  

## Correo (envio2)

| Nivel | To |
|-------|-----|
| 1–2 | `becas.kinder@winston93.edu.mx` |
| 3 | `becas.primaria@winston93.edu.mx` |
| 4 | `becas.secundaria@winston93.edu.mx` |

BCC: `sistemas3@winston93.edu.mx`.

## Peculiaridades / bugs legacy (no reproducir)

- `echo` de la clave en claro; 63 keys en fuente.
- `Nivel` del 1.er form no pinta el PDF; se pide otra vez en final2.
- Checkboxes sin `value` → `"on"`.
- Credencial SMTP en texto plano en el PHP.
- Body de correo con campo `msn` inexistente.
- Nombre de archivo PDF con espacios/acentos.

## Qué cambió en Next/InsForge

| Legacy | Nuevo |
|--------|-------|
| 63 códigos | `alumno_permiso_solicitud_beca` + pedido de acceso |
| Form libre sin identidad | `?alumno_ref=` + maestro `alumno` |
| Solo PDF en disco | `becas_solicitud*` + Storage |
| Sin bloqueo si ya tiene beca | Gate: fila en `alumno_beca` → 403 |
| Correo en envio2 | Finalizar / acceso vía SMTP Nodemailer |

Detalle de arquitectura: [`09-solicitud-arquitectura.md`](09-solicitud-arquitectura.md).  
Mapeo campo a campo: [`10-formulario-solicitud-campos.md`](10-formulario-solicitud-campos.md).
