import type { Prisma } from '@prisma/client';
import type { AuthRole, AuthSession } from './session';

const managerRoutes = [
  '/dashboard',
  '/properties',
  '/tenants',
  '/leases',
  '/applications',
  '/payments',
  '/returns',
  '/rent-comps',
  '/maintenance',
  '/documents',
  '/integrations',
];

const tenantRoutes = ['/home', '/pay', '/lease', '/repairs'];

function matchesRoute(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function requiredRoleForRoute(pathname: string): 'MANAGER' | 'TENANT' | null {
  if (managerRoutes.some((prefix) => matchesRoute(pathname, prefix))) return 'MANAGER';
  if (tenantRoutes.some((prefix) => matchesRoute(pathname, prefix))) return 'TENANT';
  return null;
}

export function canAccessRole(
  role: AuthRole | undefined,
  requiredRole: 'MANAGER' | 'TENANT',
): boolean {
  if (requiredRole === 'MANAGER') return role === 'MANAGER' || role === 'OWNER';
  return role === 'TENANT';
}

/** Only managers may perform writes through manager-only actions. Owners are read-only. */
export function canWriteAsRole(role: AuthRole | undefined): boolean {
  return role === 'MANAGER';
}

export function roleHome(role: AuthRole): string {
  if (role === 'TENANT') return '/home';
  if (role === 'MANAGER' || role === 'OWNER') return '/dashboard';
  return '/sign-out';
}

export function safeRedirectTarget(candidate: string | null | undefined, role: AuthRole): string {
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\')
  ) {
    return roleHome(role);
  }
  const requiredRole = requiredRoleForRoute(candidate);
  return requiredRole && canAccessRole(role, requiredRole) ? candidate : roleHome(role);
}

export function buildLeaseAccessWhere(
  session: Pick<AuthSession, 'role' | 'organizationId' | 'tenantId'> &
    Partial<Pick<AuthSession, 'subjectId'>>,
  leaseId: string,
): Prisma.LeaseWhereInput | null {
  if (session.role === 'TENANT') {
    if (!session.tenantId) return null;
    return {
      id: leaseId,
      organizationId: session.organizationId,
      tenants: {
        some: {
          tenantId: session.tenantId,
          organizationId: session.organizationId,
        },
      },
    };
  }
  if (session.role === 'MANAGER') {
    return { id: leaseId, organizationId: session.organizationId };
  }
  if (session.role === 'OWNER' && session.subjectId) {
    return {
      id: leaseId,
      organizationId: session.organizationId,
      unit: { property: { ownerId: session.subjectId, organizationId: session.organizationId } },
    };
  }
  return null;
}

/** A manager can read the whole organization; an owner only sees their own properties. */
export function buildPropertyAccessWhere(
  session: Pick<AuthSession, 'role' | 'organizationId' | 'subjectId'>,
): Prisma.PropertyWhereInput | null {
  if (session.role === 'MANAGER') return { organizationId: session.organizationId };
  if (session.role === 'OWNER')
    return { organizationId: session.organizationId, ownerId: session.subjectId };
  return null;
}
