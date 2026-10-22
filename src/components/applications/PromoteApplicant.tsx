'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { PromotionResult } from '@/lib/applications/promotion';
import styles from './promotion.module.css';

type Match = Extract<PromotionResult, { status: 'confirmation-required' }>['tenant'];
export function PromoteApplicant({
  applicationId,
  unitId,
  tenantId,
}: {
  applicationId: string;
  unitId: string;
  tenantId: string | null;
}) {
  const router = useRouter();
  const [promotedId, setPromotedId] = useState(tenantId);
  const [match, setMatch] = useState<Match | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [reused, setReused] = useState(false);
  async function promote(existingTenantId?: string) {
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/promote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existingTenantId ? { existingTenantId } : {}),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Promotion could not be completed.');
      if (result.status === 'confirmation-required') setMatch(result.tenant);
      else {
        setPromotedId(result.tenantId);
        setReused(result.reused);
        setMatch(null);
        router.refresh();
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Reload to check promotion before retrying.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className={styles.promotion} aria-label="Tenant promotion">
      <h4>{promotedId ? 'Tenant linked' : 'Ready to become a tenant'}</h4>
      {promotedId ? (
        <>
          <p role="status">
            {reused
              ? 'Existing tenant linked. Their details are unchanged.'
              : 'This approved application is linked to a tenant.'}{' '}
            Lease setup is a separate step.
          </p>
          <div className={styles.actions}>
            <Button href={`/tenants/${encodeURIComponent(promotedId)}`} variant="secondary">
              View tenant
            </Button>
            <Button
              href={`/leases/new?${new URLSearchParams({ unit: unitId, tenant: promotedId })}`}
              variant="primary"
            >
              Create lease
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            Carry this applicant’s name and email into Tenants. Promotion does not start a lease or
            move them in.
          </p>
          {match ? (
            <div className={styles.match}>
              <p role="status">
                A tenant already uses this email. Confirm this is the same person before linking.
              </p>
              <strong>{match.name}</strong>
              <span>{match.email}</span>
              {match.phone && <span>{match.phone}</span>}
              <Link href={`/tenants/${encodeURIComponent(match.id)}`}>Review existing tenant</Link>
              <p>Their saved details, preferences and history will be kept.</p>
              <div className={styles.actions}>
                <Button
                  disabled={pending}
                  onClick={() => {
                    setMatch(null);
                    setError('');
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button disabled={pending} onClick={() => promote(match.id)} variant="primary">
                  {pending ? 'Linking…' : 'Use existing tenant'}
                </Button>
              </div>
            </div>
          ) : (
            <Button disabled={pending} onClick={() => promote()} variant="primary">
              {pending ? 'Promoting…' : 'Promote to tenant'}
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert">
          {error} <Link href="/tenants">View tenants</Link>
        </p>
      )}
    </section>
  );
}
