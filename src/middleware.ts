import { NextRequest, NextResponse } from 'next/server';
import { canAccessRole, requiredRoleForRoute, roleHome } from '@/lib/auth/policy';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const method = request.method.toUpperCase();
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && hasSessionCookie) {
    const origin = request.headers.get('origin');
    const requestHost = request.headers.get('host');
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    if (
      !origin ||
      !isAllowedRequestOrigin(origin, request.nextUrl.origin, requestHost, forwardedProtocol)
    )
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
  else {
    redirectUrl.searchParams.set('notice', 'role');
    console.info('Role access denied', {
      pathname: request.nextUrl.pathname,
      role: session.role,
      requiredRole,
    });
  }
  return NextResponse.redirect(redirectUrl);
}

export function isSameOrigin(origin: string, requestOrigin: string): boolean {
  try {
    return new URL(origin).origin === new URL(requestOrigin).origin;
  } catch {
    return false;
  }
}

export function isAllowedRequestOrigin(
  origin: string,
  requestOrigin: string,
  requestHost?: string | null,
  forwardedProtocol?: string | null,
): boolean {
  const acceptedOrigins = [requestOrigin];
  if (requestHost) {
    try {
      acceptedOrigins.push(`${new URL(requestOrigin).protocol}//${requestHost}`);
    } catch {
      return false;
    }
    if (forwardedProtocol && /^https?$/i.test(forwardedProtocol))
      acceptedOrigins.push(`${forwardedProtocol.toLowerCase()}://${requestHost}`);
  }
  return acceptedOrigins.some((candidate) => isSameOrigin(origin, candidate));
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
