#!/usr/bin/env node
/**
 * 2026-09-21 - Apunta INSFORGE_BOLETAS_* de becas-renovacion a Winston Servicios.
 * Uso: node scripts/setup-boletas-winston-vercel-env.mjs
 * Lee INSFORGE_URL / INSFORGE_API_KEY de .env.local (no imprime secretos).
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');

function loadEnvLocal() {
  if (!existsSync(envPath)) {
    throw new Error('Falta .env.local con INSFORGE_URL e INSFORGE_API_KEY');
  }
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    out[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
  }
  return out;
}

function vercelEnvRm(name, env) {
  spawnSync('npx', ['-y', 'vercel', 'env', 'rm', name, env, '-y'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function vercelEnvAdd(name, value, env) {
  const r = spawnSync(
    'npx',
    ['-y', 'vercel', 'env', 'add', name, env, '--value', value, '--yes'],
    { cwd: root, encoding: 'utf8' }
  );
  if (r.status !== 0) {
    // CLI viejo: pipe
    const r2 = spawnSync(
      'npx',
      ['-y', 'vercel', 'env', 'add', name, env],
      { cwd: root, input: value + '\n', encoding: 'utf8' }
    );
    if (r2.status !== 0) {
      console.error(r.stderr || r2.stderr || r2.stdout);
      throw new Error(`Falló vercel env add ${name} ${env}`);
    }
  }
}

const envLocal = loadEnvLocal();
const url = (envLocal.INSFORGE_URL || envLocal.NEXT_PUBLIC_INSFORGE_URL || '').trim();
const key = (envLocal.INSFORGE_API_KEY || '').trim();
const projectId =
  (envLocal.INSFORGE_BOLETAS_PROJECT_ID || '').trim() ||
  '1a769c0a-ab1b-4500-bb6b-1e8bb131980b';

if (!url.includes('g4ta4bfg')) {
  throw new Error(`INSFORGE_URL debe ser Winston (g4ta4bfg); got host sin g4ta4bfg`);
}
if (!key) throw new Error('Falta INSFORGE_API_KEY en .env.local');

const targets = ['production', 'preview', 'development'];
const pairs = [
  ['INSFORGE_BOLETAS_URL', url],
  ['INSFORGE_BOLETAS_API_KEY', key],
  ['INSFORGE_BOLETAS_PROJECT_ID', projectId],
];

console.log(`Actualizando INSFORGE_BOLETAS_* → Winston (${url.replace(/https?:\/\//, '').split('/')[0]})`);

for (const env of targets) {
  for (const [name, value] of pairs) {
    vercelEnvRm(name, env);
    vercelEnvAdd(name, value, env);
    console.log(`  ok ${name} @ ${env}`);
  }
}

console.log('Listo. Redeploy production para aplicar.');
