'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Feedback';
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
  const cancel = () => {
    if (pending) return;
    setMatch(null);
    setError('');
  };
  const errorMessage = error && (
    <p role="alert" className={styles.error}>
      {error} <Link href="/tenants">View tenants</Link>
    </p>
  );
  return (
    <section className={styles.promotion} aria-label="Tenant promotion">
      <h4>{promotedId ? 'Tenant linked' : 'Promote to tenant'}</h4>
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
            Promote to tenant links this approved applicant to a tenant record. It carries the
            applicant’s name and email into Tenants and does not start a lease or move them in.
          </p>
          <div className={styles.actions}>
            <Button disabled={pending} onClick={() => promote()} variant="primary" icon="check">
              {pending && !match ? 'Promoting…' : 'Promote to tenant'}
            </Button>
          </div>
          <p className={styles.caption}>
            With no matching contact, Promote to tenant creates one tenant. Several matches stop
            with a duplicate-contact message; nothing is merged.
          </p>
        </>
      )}
      {!match && errorMessage}
      <Dialog
        open={Boolean(match)}
        onClose={cancel}
        title="Promote to tenant · existing contact"
        description="Carries the saved name and email; creates no lease, charge or notification."
        size="sm"
        footer={
          <>
            <Button disabled={pending} onClick={cancel} variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={pending || !match}
              onClick={() => match && promote(match.id)}
              variant="primary"
              icon="check"
            >
              {pending ? 'Linking…' : 'Use existing tenant'}
            </Button>
          </>
        }
      >
        {match && (
          <div className={styles.match}>
            <Alert tone="warning">
              <div>
                <strong>This email already belongs to a tenant</strong>
                <p>
                  Confirm it is the same person. Their saved name, phone, preferences and history
                  are kept, never overwritten.
                </p>
              </div>
            </Alert>
            <div className={styles.contact}>
              <strong>{match.email}</strong>
              <span>{match.name}</span>
              {match.phone && <span>{match.phone}</span>}
              <small>Matches 1 saved tenant contact · name, email and phone as saved</small>
              <Link href={`/tenants/${encodeURIComponent(match.id)}`}>Review existing tenant</Link>
            </div>
            {errorMessage}
            <p className={styles.caption}>
              Several matches stop here with a duplicate-contact message; nothing is merged. With no
              match, Promote to tenant creates one tenant.
            </p>
          </div>
        )}
      </Dialog>
    </section>
  );
}
