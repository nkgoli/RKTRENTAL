'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatUsd } from '@/lib/tenant-pay/core';
import { setAutopayAction } from './actions';
import styles from '../portal.module.css';
import pay from './pay.module.css';

export function AutopayToggle({
  leaseId,
  enabled,
  paymentMethodId,
  paymentMethodLabel,
  monthlyRentCents,
  rentDueDay,
}: {
  leaseId: string;
  enabled: boolean;
  paymentMethodId: string | null;
  paymentMethodLabel?: string;
  monthlyRentCents: number;
  rentDueDay: number;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasMethod = Boolean(paymentMethodId);

  const toggle = (next: boolean) => {
    if (pending) return;
    if (!hasMethod && next) {
      setError(
        paymentMethodLabel
          ? `Save ${paymentMethodLabel} before turning on autopay.`
          : 'Add a payment method before turning on autopay.',
      );
      return;
    }
    setError(null);
    setOn(next);
    startTransition(async () => {
      try {
        const result = await setAutopayAction({ leaseId, enabled: next, paymentMethodId });
        if (!result.ok) {
          setOn(!next);
          setError(result.error ?? 'Autopay could not be updated.');
          return;
        }
        router.refresh();
      } catch {
        setOn(!next);
        setError('Autopay could not be updated. Check your connection and try again.');
      }
    });
  };

  return (
    <section className={`card ${pay.autopay}`} aria-labelledby="autopay-title">
      <div className={styles.autopayRow}>
        <span>
          <h2 id="autopay-title" style={{ display: 'block', fontSize: 14 }}>
            Autopay
          </h2>
          <small className="muted">
            Currently {on ? 'on' : 'off'} · {formatUsd(monthlyRentCents)} on the {rentDueDay}
            {[1, 21, 31].includes(rentDueDay)
              ? 'st'
              : [2, 22].includes(rentDueDay)
                ? 'nd'
                : [3, 23].includes(rentDueDay)
                  ? 'rd'
                  : 'th'}{' '}
            of each month
          </small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Autopay"
          aria-describedby="autopay-status"
          className={pay.switch}
          disabled={pending}
          onClick={() => toggle(!on)}
        />
      </div>
      <p
        id="autopay-status"
        role={error ? 'alert' : 'status'}
        className={error ? styles.error : styles.status}
      >
        {pending
          ? 'Saving…'
          : error
            ? error
            : on
              ? `${paymentMethodLabel ? `Pays from ${paymentMethodLabel}. ` : ''}Pause anytime before the due date.`
              : hasMethod
                ? `${paymentMethodLabel ? `Will pay from ${paymentMethodLabel}. ` : ''}Pause anytime before the due date.`
                : paymentMethodLabel
                  ? `Save ${paymentMethodLabel} to use it for autopay.`
                  : 'Save a payment method to use autopay.'}
      </p>
    </section>
  );
}
