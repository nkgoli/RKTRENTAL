import { NextRequest, NextResponse } from 'next/server';
import { canAccessRole, requiredRoleForRoute, roleHome } from '@/lib/auth/policy';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
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
  ],
};
