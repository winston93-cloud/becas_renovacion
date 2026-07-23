# Migración de datos legacy (MySQL → InsForge)

## Estado actual (2026-07-16)

**No hace falta migrar el maestro de alumnos.** En InsForge `public` ya existen con datos reales:

- `alumno`
- `alumno_detalles`
- `alumno_familiar`
- `alumno_beca` (~826 filas)

La app de renovación lee esas tablas directamente. Solo se crean filas nuevas en `becas_renovacion` / `becas_hermano` / `becas_documento` cuando el padre completa el formulario.

## Script ETL obsoleto para maestro

`scripts/migrate-mysql-to-insforge.ts` se escribió cuando se asumía que había que copiar el maestro a tablas `becas_alumno*`. **No lo ejecutes** para esas tablas: duplicaría datos y desincronizaría el ecosistema Winston.

Si en el futuro se necesita migrar histórico de `becasr`/`obs_becas` del PHP hacia `becas_renovacion`, ese sí sería un script aparte y supervisado (ver sección anterior en historial del plan).

## Qué sí vive solo en las tablas `becas_*` de renovación

- Catálogo `becas_concepto_beca` (seed en migración).
- Solicitudes de renovación del ciclo (`becas_renovacion`).
- Hermanos y PDFs asociados.
