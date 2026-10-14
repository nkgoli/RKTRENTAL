import { NextRequest, NextResponse } from 'next/server';
import { canAccessRole, requiredRoleForRoute, roleHome } from '@/lib/auth/policy';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const method = request.method.toUpperCase();
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && hasSessionCookie) {
    const origin = request.headers.get('origin');
    if (!origin || !isSameOrigin(origin, request.nextUrl.origin))
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const requiredRole = requiredRoleForRoute(request.nextUrl.pathname);
  if (!requiredRole) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (session && canAccessRole(session.role, requiredRole)) return NextResponse.next();

  const redirectUrl = new URL(session ? roleHome(session.role) : '/sign-in', request.url);
  if (!session && token) {
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  if (!session) redirectUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

export function isSameOrigin(origin: string, requestOrigin: string): boolean {
  try {
    return new URL(origin).origin === new URL(requestOrigin).origin;
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/properties/:path*',
    '/tenants/:path*',
    '/leases/:path*',
    '/applications/:path*',
    '/payments/:path*',
    '/returns/:path*',
    '/rent-comps/:path*',
    '/maintenance/:path*',
    '/documents/:path*',
    '/integrations/:path*',
    '/home/:path*',
    '/pay/:path*',
    '/lease/:path*',
    '/repairs/:path*',
    '/api/:path*',
  ],
};
