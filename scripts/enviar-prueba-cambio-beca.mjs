/**
 * Prueba de redacción — aviso cambio de beca autorizada.
 * Uso: node --env-file=.env.local scripts/enviar-prueba-cambio-beca.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// Compilar al vuelo vía tsx si está disponible; si no, HTML embebido mínimo.
const to = process.env.PRUEBA_EMAIL_TO?.trim() || 'sistemas.desarrollo@winston93.edu.mx';

async function main() {
  const { buildBecaCambioAutorizadaEmailHtml, buildBecaCambioAutorizadaEmailSubject } =
    await import('../src/lib/email-beca-cambio-autorizada.ts');
  const { sendMail } = await import('../src/lib/mailer.ts');

  const data = {
    alumnoNombre: 'ALUMNO DE PRUEBA SECUNDARIA',
    alumnoRef: '99999',
    nivelLabel: 'Secundaria',
    gradoGrupo: '9no. Grado / B',
    cicloLabel: '2026 - 2027',
    flujo: 'renovacion',
    becaAnteriorLabel: 'PEMEX',
    becaNuevaLabel: 'PEMEX',
    porcentajeAnterior: '20%',
    porcentajeNuevo: '15%',
  };

  const sent = await sendMail({
    to,
    subject: `[PRUEBA] ${buildBecaCambioAutorizadaEmailSubject(data)}`,
    html: buildBecaCambioAutorizadaEmailHtml(data),
  });
  console.log('Correo de prueba enviado a', to, '→', sent.messageId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
