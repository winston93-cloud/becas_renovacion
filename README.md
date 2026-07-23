# Portal de Becas — Next.js + InsForge

Extensión del sistema PHP de becas Winston. Cubre:

1. **Renovación** — alumnos reinscriptos con beca activa (`/renovacion`)
2. **Solicitud nueva** — primera vez, con permiso en `alumno` (`/solicitud`) — 2026-07-17

> **¿Eres un agente de IA trabajando en este repo?** Lee [`AGENTS.md`](AGENTS.md) primero — enlaza a la documentación técnica completa en [`docs/`](docs/).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- InsForge (Postgres + Storage) — proyecto `Winston Servicios`

## Identificación del alumno

Acceso en `/` con **No. de Control** + **contraseña** (`alumno_clave`). Luego:

```text
/renovacion?alumno_ref=<No.Control>
/solicitud?alumno_ref=<No.Control>
```

| Flujo | Gate |
|-------|------|
| Renovación | Beca en ciclo a renovar (= calendario − 1) con `beca_estatus = 1` |
| Solicitud | `alumno_permiso_solicitud_beca = 1` **y** sin filas en `alumno_beca` |

## Deploy

Repo: `https://github.com/winston93-cloud/becas_renovacion`  
Enlazar a Vercel (Next.js). Variables: ver `.env.example` (`INSFORGE_*`, `SMTP_*`, `BECAS_EMAIL_*`, `ACCESO_TOKEN_SECRET`).

## Tablas InsForge

### Maestro (ya existían en `public`)

| Tabla | Uso |
|-------|-----|
| `alumno` | Identidad + `alumno_permiso_solicitud_beca` |
| `alumno_detalles` | Domicilio / clave |
| `alumno_familiar` | Madre/padre (`tutor_id` 1/2) |
| `alumno_beca` | Beca por ciclo (bloquea solicitud nueva si existe) |

### Propias de renovación

| Tabla | Uso |
|-------|-----|
| `becas_concepto_beca` | Catálogo (incluye Deportiva Ajedrez = 18) |
| `becas_renovacion` | Motivo, checklist, PDF |
| `becas_hermano` / `becas_documento` | Hermanos y PDFs |

### Propias de solicitud (2026-07-17)

| Tabla | Uso |
|-------|-----|
| `becas_solicitud` | Formulario + `enviado` |
| `becas_solicitud_hermano` | Hasta 4 hermanos |
| `becas_solicitud_documento` | 4 PDFs en Storage |

### Deprecadas (no usar)

`becas_alumno`, `becas_alumno_detalle`, `becas_familiar`, `becas_alumno_beca`.

Bucket privado: `becas-documentos`.

## Desarrollo local

```bash
npm install
# Configura .env.local (ver .env.example)
npm run dev
```

- Renovación: http://localhost:3000/renovacion?alumno_ref=\<No.Control con beca\>
- Solicitud: http://localhost:3000/solicitud?alumno_ref=\<No.Control autorizado sin alumno_beca\>

Activar permiso de solicitud:

```sql
UPDATE alumno SET alumno_permiso_solicitud_beca = 1
WHERE alumno_ref = <no_control>;
```

## Documentación

Ver [`docs/`](docs/) y especialmente:

- [`docs/08-sistema-legacy-solicitud.md`](docs/08-sistema-legacy-solicitud.md)
- [`docs/09-solicitud-arquitectura.md`](docs/09-solicitud-arquitectura.md)
- [`docs/07-pendientes-y-alcance-futuro.md`](docs/07-pendientes-y-alcance-futuro.md)
