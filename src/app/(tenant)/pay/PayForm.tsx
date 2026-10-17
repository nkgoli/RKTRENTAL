'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { cardFeeCents, formatUsd, MOCK_TOKENS } from '@/lib/tenant-pay/core';
import type { SavedMethod } from '@/lib/tenant-pay/service';
import { addPaymentMethodAction, payRentAction } from './actions';

type Option = {
  key: string;
  type: 'card' | 'ach';
  title: string;
  detail: string;
  token?: string;
  methodId?: string;
};

function parseAmountCents(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return 0;
  const [dollars, fraction = ''] = cleaned.split('.');
  return Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
}

export function PayForm({
  leaseId,
  totalDueCents,
  passFees,
  methods,
}: {
  leaseId: string;
  totalDueCents: number;
  passFees: boolean;
  methods: SavedMethod[];
}) {
  const options = useMemo<Option[]>(() => {
    const saved: Option[] = methods.map((m) => ({
      key: `saved:${m.id}`,
      type: m.type,
      title: m.type === 'card' ? 'Card' : 'Bank transfer (ACH)',
      detail: `${m.label} · Saved`,
      methodId: m.id,
    }));
    const mock: Option[] = (['ach', 'card'] as const).map((type) => ({
      key: `mock:${type}`,
      type,
      title: MOCK_TOKENS[type].label,
      detail:
        type === 'card'
          ? `${MOCK_TOKENS[type].detail}${passFees ? '' : ' · No fee'}`
          : `${MOCK_TOKENS[type].detail} · No fee · 1–2 days`,
      token: MOCK_TOKENS[type].token,
    }));
    return [...saved, ...mock];
  }, [methods, passFees]);

  const [selectedKey, setSelectedKey] = useState(options[0]?.key ?? 'mock:ach');
  const [amount, setAmount] = useState((totalDueCents / 100).toFixed(2));
  const [confirming, setConfirming] = useState(false);
  const selected = options.find((o) => o.key === selectedKey) ?? options[0];
  const amountCents = parseAmountCents(amount);
  const feeCents = selected?.type === 'card' ? cardFeeCents(amountCents, passFees) : 0;
  const chargedCents = amountCents + feeCents;
  const amountValid = amountCents > 0 && amountCents <= totalDueCents;

  return (
    <section aria-labelledby="payment-method-title">
      <h2 id="payment-method-title" style={{ fontSize: 16, marginBottom: 12 }}>
        Payment method
      </h2>
      <form action={payRentAction} className="stack" style={{ gap: 10 }}>
        <input type="hidden" name="leaseId" value={leaseId} />
        <input type="hidden" name="method" value={selected?.type ?? 'ach'} />
        <input type="hidden" name="providerToken" value={selected?.token ?? ''} />
        <input type="hidden" name="paymentMethodId" value={selected?.methodId ?? ''} />
        {options.map((option) => {
          const fee =
            option.type === 'card' && passFees
              ? ` · +${formatUsd(cardFeeCents(amountCents || totalDueCents, true))} fee (2.9%)`
              : '';
          return (
            <label
              key={option.key}
              className={cx('option', selectedKey === option.key && 'selected')}
            >
              <input
                type="radio"
                name="pay-option"
                checked={selectedKey === option.key}
                onChange={() => {
                  setSelectedKey(option.key);
                  setConfirming(false);
                }}
              />
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 14 }}>{option.title}</strong>
                <small className="muted">
                  {option.detail}
                  {fee}
                </small>
              </span>
            </label>
          );
        })}

        {/* The method above already names the account; this only explains who holds the details. */}
        <p className="muted" role="note" aria-label="Provider hosted payment field" style={{ fontSize: 12 }}>
          Account details are entered with your payment provider; RocketRental never sees or stores
          them.
        </p>

        <label className="field">
          Amount
          <input
            name="amount"
            inputMode="decimal"
            aria-label="Amount"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setConfirming(false);
            }}
          />
          <span className="hint">
            {feeCents > 0
              ? `Card fee ${formatUsd(feeCents)} (2.9%) · Total charged ${formatUsd(chargedCents)}`
              : `Total charged ${formatUsd(chargedCents)}`}
          </span>
        </label>

        <label className="check">
          <input type="checkbox" name="saveMethod" disabled={Boolean(selected?.methodId)} />
          Save this payment method
        </label>

        {!confirming ? (
          <Button
            variant="primary"
            block
            disabled={!amountValid || !selected}
            onClick={() => setConfirming(true)}
          >
            Pay {formatUsd(chargedCents || totalDueCents)}
          </Button>
        ) : (
          <div className="card" role="group" aria-label="Confirm payment" style={{ padding: 14 }}>
            <strong style={{ display: 'block', fontSize: 14 }}>Confirm payment</strong>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>
              Pay {formatUsd(amountCents)} by {selected?.title.toLowerCase()}
              {feeCents > 0 ? ` plus a ${formatUsd(feeCents)} card fee` : ''} —{' '}
              {formatUsd(chargedCents)} in total?
            </p>
            <div className="row" style={{ gap: 8 }}>
              <Button type="submit" variant="primary">
                Confirm payment
              </Button>
              <Button onClick={() => setConfirming(false)}>Back</Button>
            </div>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          Secured by your payment provider · No card data is stored by RocketRental.
        </p>
      </form>

      <AddPaymentMethods />
    </section>
  );
}

/** Adds a method through the provider's hosted fields (mock tokens in this demo). */
export function AddPaymentMethods() {
  return (
    <div className="stack" style={{ gap: 8, marginTop: 10 }}>
      {(['ach', 'card'] as const).map((type) => (
        <form key={type} action={addPaymentMethodAction}>
          <input type="hidden" name="method" value={type} />
          <input type="hidden" name="providerToken" value={MOCK_TOKENS[type].token} />
          <Button type="submit" variant="secondary" block>
            + Add {type === 'ach' ? 'bank account' : 'card'} ({MOCK_TOKENS[type].detail})
          </Button>
        </form>
      ))}
    </div>
  );
}
