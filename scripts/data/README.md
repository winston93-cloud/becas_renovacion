# Coloca aquí los exports JSON desde MySQL (winston_general):
#
#   alumno.json
#   alumno_detalles.json
#   alumno_familiar.json
#   alumno_beca.json
#
# Cada archivo debe ser un array de objetos con las columnas originales.
# Ejemplo de exportación en phpMyAdmin: Exportar → Formato JSON.
#
# Luego ejecuta desde la raíz del proyecto:
#   npx tsx --env-file=.env.local scripts/migrate-mysql-to-insforge.ts
