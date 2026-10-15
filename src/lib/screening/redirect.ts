import { scopeQuery, type ScopeFilter } from '@/lib/workspace/scope';

/** Applications URL for a screening action result, keeping the property/unit scope. */
export function applicationsRedirectUrl(
  applicationId: string,
  notice: string,
  scope: ScopeFilter,
): string {
  const query = scopeQuery(scope);
  query.set('applicant', applicationId);
  query.set('notice', notice);
  return '/applications?' + query.toString();
}
