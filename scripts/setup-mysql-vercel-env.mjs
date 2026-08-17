/**
 * 2026-08-13 - Copia MYSQL_* a Vercel del proyecto becas-renovacion.
 *
 * Uso (desde este repo, con VERCEL_TOKEN y MYSQL_* en el entorno o .env.local):
 *   node --env-file=.env.local scripts/setup-mysql-vercel-env.mjs
 *
 * Requiere: VERCEL_TOKEN, VERCEL_PROJECT_ID (o --project), MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD.
 */
import { readFileSync, existsSync } from 'node:fs';

function loadDotEnvLocal() {
  const p = new URL('../.env.local', import.meta.url);
  const path = p.pathname;
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadDotEnvLocal();

const token = process.env.VERCEL_TOKEN?.trim();
const projectId =
  process.env.VERCEL_PROJECT_ID?.trim() ||
  process.argv.find((a) => a.startsWith('--project='))?.slice('--project='.length);
const teamId = process.env.VERCEL_TEAM_ID?.trim();

const keys = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
const missing = keys.filter((k) => !process.env[k]?.trim() && k !== 'MYSQL_PORT' && k !== 'MYSQL_DATABASE');
if (!token) {
  console.error('Falta VERCEL_TOKEN');
  process.exit(1);
}
if (!projectId) {
  console.error('Falta VERCEL_PROJECT_ID o --project=...');
  process.exit(1);
}
if (missing.length) {
  console.error('Faltan variables:', missing.join(', '));
  process.exit(1);
}

const base = 'https://api.vercel.com';
const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

async function upsert(key, value) {
  const res = await fetch(`${base}/v10/projects/${projectId}/env${qs}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log('OK', key);
    return;
  }
  // Si ya existe, PATCH via list+update es más largo; reportar.
  console.error('FAIL', key, res.status, body?.error?.message || JSON.stringify(body));
}

const values = {
  MYSQL_HOST: process.env.MYSQL_HOST.trim(),
  MYSQL_PORT: (process.env.MYSQL_PORT || '3306').trim(),
  MYSQL_USER: process.env.MYSQL_USER.trim(),
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
  MYSQL_DATABASE: (process.env.MYSQL_DATABASE || 'winston_general').trim(),
};

for (const [k, v] of Object.entries(values)) {
  await upsert(k, v);
}
console.log('Listo. Redeploy del proyecto para tomar las variables.');
