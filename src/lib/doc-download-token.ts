/**
 * 2026-07-16 - Tokens HMAC para links de descarga de PDFs en el correo.
 * Server-only: no importar desde el cliente.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

function getSecret(): string {
  const secret = process.env.BECAS_DOC_LINK_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'Falta BECAS_DOC_LINK_SECRET (mín. 16 caracteres) en el entorno del servidor.'
    );
  }
  return secret;
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

export type DocLinkPayload = {
  documentoId: string;
  exp: number; // unix seconds
};

/**
 * Firma un token opaco: base64url(payloadJson).base64url(hmac)
 */
export function signDocLink(
  documentoId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  const payload: DocLinkPayload = {
    documentoId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function verifyDocLink(token: string): DocLinkPayload | null {
  try {
    const [body, sigPart] = token.split('.');
    if (!body || !sigPart) return null;

    const expected = createHmac('sha256', getSecret()).update(body).digest();
    const actual = b64urlDecode(sigPart);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    const payload = JSON.parse(
      b64urlDecode(body).toString('utf8')
    ) as DocLinkPayload;

    if (!payload.documentoId || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
