# AGENTS.md — Guía para agentes de IA

Este archivo es el punto de entrada para cualquier agente de IA (Cursor, Claude, Copilot, etc.) que trabaje en este repositorio. Léelo antes de tocar código.

## Qué es este proyecto

`becas-renovacion` es una app Next.js (App Router + TypeScript + Tailwind) que reemplaza y extiende partes del sistema PHP legacy de becas del Instituto Winston Churchill:

1. **Renovación de beca** — alumnos reinscritos con beca previa (`/renovacion`).
2. **Solicitud de beca (nuevo ingreso)** — primera vez, con permiso explícito (`/solicitud`). Implementado 2026-07-17.

La app funciona como **extensión** del sistema web escolar: identifica al alumno por `?alumno_ref=` (No. de Control) **y** valida la contraseña (`alumno_detalles.alumno_clave`) en el inicio. Tras el login se guarda un token de sesión (8 h) en `sessionStorage`; las APIs exigen el header `X-Becas-Acceso`.

Backend: **InsForge** (Postgres + Storage administrados), proyecto `Winston Servicios` (`1a769c0a-ab1b-4500-bb6b-1e8bb131980b`).

## Documentación completa

Toda la documentación técnica detallada vive en `docs/`. Léela en este orden según lo que necesites:

| Documento | Contenido |
|---|---|
| [`docs/01-sistema-legacy-php.md`](docs/01-sistema-legacy-php.md) | Legacy PHP — renovación |
| [`docs/02-arquitectura-nueva.md`](docs/02-arquitectura-nueva.md) | Arquitectura renovación, seguridad, identificación |
| [`docs/03-esquema-base-datos.md`](docs/03-esquema-base-datos.md) | Tablas `becas_*` de renovación + maestro `alumno*` |
| [`docs/04-api-rutas.md`](docs/04-api-rutas.md) | Contrato API renovación |
| [`docs/05-frontend-componentes.md`](docs/05-frontend-componentes.md) | UI renovación |
| [`docs/06-migracion-datos.md`](docs/06-migracion-datos.md) | ETL MySQL → InsForge |
| [`docs/07-pendientes-y-alcance-futuro.md`](docs/07-pendientes-y-alcance-futuro.md) | Pendientes y alcance |
| [`docs/08-sistema-legacy-solicitud.md`](docs/08-sistema-legacy-solicitud.md) | Legacy PHP — solicitud nueva (flujo, auth, correo) |
| [`docs/09-solicitud-arquitectura.md`](docs/09-solicitud-arquitectura.md) | Gate, tablas `becas_solicitud*`, API y UI de solicitud |
| [`docs/10-formulario-solicitud-campos.md`](docs/10-formulario-solicitud-campos.md) | **Catálogo completo del formulario** Index2 + documentos + mapeo Next/InsForge + gaps |

## Reglas rápidas para trabajar en este repo

1. **Nunca** expongas `INSFORGE_API_KEY` al cliente. Solo se usa en código server-only (`src/lib/insforge-server.ts`, Route Handlers en `src/app/api/**`).
2. Las tablas propias (`becas_renovacion`, `becas_hermano`, `becas_documento`, `becas_solicitud*`, `becas_concepto_beca`) tienen `REVOKE ALL` para `anon`/`authenticated`. El maestro (`alumno`, `alumno_detalles`, `alumno_familiar`, `alumno_beca`) es compartido; esta app solo lo toca vía Route Handlers con API key.
3. El identificador de negocio del alumno es `alumno_ref` (No. de Control, **integer** en BD). Las URLs públicas usan `?alumno_ref=`.
4. **Renovación:** solo si tiene `alumno_beca` con `beca_estatus = 0` (beca del ciclo cerrado / pendiente de renovar) en el ciclo a renovar = calendario − 1 (`getCicloBecaARenovar()`). El home valida el acceso antes de entrar al formulario.
5. **Solicitud nueva:** el home pide primero acceso (`POST /api/solicitud/acceso` → marca `alumno_solicitud_acceso_enviada` y correo a becas.*). El formulario `/solicitud` solo si `alumno_permiso_solicitud_beca = 1` **y** no existe fila en `alumno_beca`. Ciclo calendario (`getCurrentSchoolCycle()`).
6. **No uses** las tablas deprecadas `becas_alumno`, `becas_alumno_detalle`, `becas_familiar`, `becas_alumno_beca`.
7. Cambios de esquema van en `migrations/<timestamp>_<nombre>.sql` y se aplican con `npx @insforge/cli db migrations up --all`. Nunca editar una migración ya aplicada.
8. Este repo es hermano del sistema PHP legacy (`c:\Users\rafas\Desktop\becas`), no vive dentro de él.
9. Comenta los cambios que hagas con fecha y motivo breve (`// 2026-07-17 - ...`).
