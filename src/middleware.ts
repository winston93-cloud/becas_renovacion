/**
 * 2026-07-24 - Protege /admin/* (excepto login). Verificación HMAC completa en layout/API.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/admin-roles';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!raw || !raw.includes('.')) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
