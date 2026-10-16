'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/Forms';
import { formatUsd } from '@/lib/tenant-pay/core';
import { setAutopayAction } from './actions';

export function AutopayToggle({
  leaseId,
  enabled,
  paymentMethodId,
  monthlyRentCents,
  rentDueDay,
}: {
  leaseId: string;
  enabled: boolean;
  paymentMethodId: string | null;
  monthlyRentCents: number;
  rentDueDay: number;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasMethod = Boolean(paymentMethodId);

  const toggle = (next: boolean) => {
    if (!hasMethod && next) {
      setError('Add a payment method before turning on autopay.');
      return;
    }
    setError(null);
    setOn(next);
    startTransition(async () => {
      const result = await setAutopayAction({ leaseId, enabled: next, paymentMethodId });
      if (!result.ok) {
        setOn(!next);
        setError(result.error ?? 'Autopay could not be updated.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="card" aria-labelledby="autopay-title">
      <div className="row between">
        <span>
          <strong id="autopay-title" style={{ display: 'block', fontSize: 14 }}>
            Autopay
          </strong>
          <small className="muted">
            Currently {on ? 'on' : 'off'} · Pay {formatUsd(monthlyRentCents)} on the {rentDueDay}{[1, 21].includes(rentDueDay) ? 'st' : [2, 22].includes(rentDueDay) ? 'nd' : [3, 23].includes(rentDueDay) ? 'rd' : 'th'} each month
          </small>
        </span>
        <Switch on={on} label="Autopay" onChange={toggle} />
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        {pending
          ? 'Saving…'
          : error
            ? error
            : on
              ? 'Autopay is on. You can pause anytime before the due date.'
              : hasMethod
                ? 'Turn on autopay to never miss a due date. You can pause anytime before the due date.'
                : 'Add a payment method above, then turn on autopay to never miss a due date.'}
      </p>
    </section>
  );
}
