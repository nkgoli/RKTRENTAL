'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cx } from '@/components/ui/cx';
import { cardFeeCents, formatUsd, MOCK_TOKENS } from '@/lib/tenant-pay/core';
import type { SavedMethod } from '@/lib/tenant-pay/service';
import { addPaymentMethodAction } from './actions';
import portal from '../portal.module.css';
import styles from './pay.module.css';
import { PayIcon } from './PayIcon';
import { AutopayToggle } from './AutopayToggle';

function ConfirmButton({ pending, total }: { pending: boolean; total: number }) {
  return (
    <Button
      type="submit"
      name="confirmPayment"
      value="yes"
      variant="primary"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Submitting payment…' : `Pay ${formatUsd(total)}`}
    </Button>
  );
}

function AddMethodButton({ type }: { type: 'ach' | 'card' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" block disabled={pending}>
      {pending ? 'Adding method…' : `Add ${type === 'ach' ? 'bank account' : 'card'}`}
    </Button>
  );
}

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
  autopay,
}: {
  leaseId: string;
  totalDueCents: number;
  passFees: boolean;
  methods: SavedMethod[];
  autopay?: {
    enabled: boolean;
    paymentMethodId: string | null;
    monthlyRentCents: number;
    rentDueDay: number;
  };
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
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const amountInput = useRef<HTMLInputElement>(null);
  const closeConfirmation = () => {
    if (submitted.current) return;
    setConfirming(false);
    requestAnimationFrame(() => document.getElementById('review-payment')?.focus());
  };
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      submitted.current = false;
      setSubmitting(false);
      setConfirming(false);
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  const selected = options.find((o) => o.key === selectedKey) ?? options[0];
  const amountCents = parseAmountCents(amount);
  const feeCents = selected?.type === 'card' ? cardFeeCents(amountCents, passFees) : 0;
  const chargedCents = amountCents + feeCents;
  const amountValid = amountCents > 0 && amountCents <= totalDueCents;

  return (
    <section className={styles.payment} aria-labelledby="payment-method-title" id="payment-method">
      <h2 id="payment-method-title" style={{ fontSize: 16, marginBottom: 12 }}>
        Payment method
      </h2>
      <form
        action="/pay/submit"
        method="post"
        aria-busy={submitting}
        className="stack"
        style={{ gap: 12 }}
        onSubmit={(event) => {
          if (submitted.current) {
            event.preventDefault();
            return;
          }
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          if (!confirming || !amountValid || submitter?.getAttribute('name') !== 'confirmPayment') {
            event.preventDefault();
            if (amountValid) setConfirming(true);
            else amountInput.current?.focus();
            return;
          }
          submitted.current = true;
          setSubmitting(true);
        }}
      >
        <input type="hidden" name="leaseId" value={leaseId} />
        {confirming && <input type="hidden" name="confirmPayment" value="yes" />}
        <input type="hidden" name="method" value={selected?.type ?? 'ach'} />
        <input type="hidden" name="providerToken" value={selected?.token ?? ''} />
        <input type="hidden" name="paymentMethodId" value={selected?.methodId ?? ''} />
        <fieldset className={portal.methodFields} aria-labelledby="payment-method-title">
          {options.map((option) => {
            const fee =
              option.type === 'card' && passFees
                ? ` · +${formatUsd(cardFeeCents(amountCents || totalDueCents, true))} fee (2.9%)`
                : '';
            return (
              <label
                key={option.key}
                className={cx(styles.option, selectedKey === option.key && styles.selected)}
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
        </fieldset>

        {/* The method above already names the account; this only explains who holds the details. */}
        <p
          className="muted"
          role="note"
          aria-label="Provider hosted payment field"
          style={{ fontSize: 12 }}
        >
          Account details are entered with your payment provider; RocketRental never sees or stores
          them.
        </p>

        <label className="field">
          Amount
          <input
            ref={amountInput}
            name="amount"
            inputMode="decimal"
            aria-label="Amount"
            aria-invalid={!amountValid}
            aria-describedby={!amountValid ? 'amount-error amount-total' : 'amount-total'}
            value={amount}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (amountValid) setConfirming(true);
                else amountInput.current?.focus();
              }
            }}
            onChange={(event) => {
              setAmount(event.target.value);
              setConfirming(false);
            }}
          />
          {!amountValid && (
            <span id="amount-error" className={portal.error} role="alert">
              Enter an amount from $0.01 to {formatUsd(totalDueCents)}, with no more than two
              decimal places.
            </span>
          )}
          <span className="hint" id="amount-total">
            {feeCents > 0
              ? `Card fee ${formatUsd(feeCents)} (2.9%) · Total charged ${formatUsd(chargedCents)}`
              : `Total charged ${formatUsd(chargedCents)}`}
          </span>
        </label>

        <label className="check">
          <input type="checkbox" name="saveMethod" disabled={Boolean(selected?.methodId)} />
          Save this payment method
        </label>

        <Button
          id="review-payment"
          variant="primary"
          block
          disabled={!amountValid || !selected}
          onClick={() => setConfirming(true)}
        >
          <PayIcon name="pay" /> Pay {formatUsd(chargedCents || totalDueCents)}
        </Button>
        <Dialog
          open={confirming}
          onClose={closeConfirmation}
          title="Confirm payment"
          size="sm"
          className={styles.confirmation}
          footer={
            <>
              <Button data-autofocus disabled={submitting} onClick={closeConfirmation}>
                Cancel
              </Button>
              <ConfirmButton pending={submitting} total={chargedCents} />
            </>
          }
        >
          <p>
            Pay {formatUsd(amountCents)} by{' '}
            {selected?.type === 'ach' ? 'bank transfer (ACH)' : 'card'}?
          </p>
          <p className="muted">{selected?.detail}</p>
          <dl className={styles.reviewTotals}>
            <dt>Amount</dt>
            <dd>{formatUsd(amountCents)}</dd>
            <dt>{feeCents > 0 ? 'Card fee (2.9%)' : 'Fee'}</dt>
            <dd>{formatUsd(feeCents)}</dd>
            <dt>Total charged</dt>
            <dd>{formatUsd(chargedCents)}</dd>
          </dl>
        </Dialog>
        <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          Secured by your payment provider · No card data is stored by RocketRental.
        </p>
      </form>

      <AddPaymentMethods />
      {autopay && (
        <AutopayToggle
          leaseId={leaseId}
          enabled={autopay.enabled}
          paymentMethodId={autopay.enabled ? autopay.paymentMethodId : (selected?.methodId ?? null)}
          paymentMethodLabel={
            autopay.enabled
              ? methods.find((method) => method.id === autopay.paymentMethodId)?.label
              : selected?.methodId
                ? methods.find((method) => method.id === selected.methodId)?.label
                : selected?.detail.split(' · ')[0]
          }
          monthlyRentCents={autopay.monthlyRentCents}
          rentDueDay={autopay.rentDueDay}
        />
      )}
    </section>
  );
}

/** Adds a method through the provider's hosted fields (mock tokens in this demo). */
export function AddPaymentMethods() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.addMethods}>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Add a payment method
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a payment method"
        description="Choose bank transfer or card. Your provider securely stores the account details."
        size="sm"
        className={styles.confirmation}
      >
        <div className={styles.methodChoices}>
          {(['ach', 'card'] as const).map((type) => (
            <form key={type} action={addPaymentMethodAction}>
              <input type="hidden" name="method" value={type} />
              <input type="hidden" name="providerToken" value={MOCK_TOKENS[type].token} />
              <p>
                <strong>{type === 'ach' ? 'Bank transfer (ACH)' : 'Card'}</strong>
              </p>
              <p className="muted">{MOCK_TOKENS[type].detail}</p>
              <AddMethodButton type={type} />
            </form>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
