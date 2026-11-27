'use client';

import type { ReactNode } from 'react';
import type { TenantOption, WizardDraft } from '@/lib/lease-create/types';
import { formatMoney } from '@/lib/ledger/statement';
import { Glyph } from './icons';
import styles from './lease-builder.module.css';
import { centsOf, cx, dueAtMoveIn, ordinal, termFacts } from './summary';

/**
 * The lease as it stands, from the in-memory draft: a sticky right rail on wide screens and a
 * collapsible bar above the step on narrower ones (the same element, so nothing renders twice).
 */
export function SummaryRail({
  draft,
  placeLabel,
  tenants,
  fileCount,
  open,
  onToggle,
}: {
  draft: WizardDraft;
  placeLabel: string;
  tenants: TenantOption[];
  fileCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const term = termFacts(draft);
  const rent = centsOf(draft.monthlyRent);
  const deposit = centsOf(draft.deposit);
  const due = dueAtMoveIn(draft);
  const selected = draft.tenantIds.flatMap((id) => tenants.filter((tenant) => tenant.id === id));
  const facts: [string, ReactNode][] = [
    ['Unit', placeLabel],
    [
      'Term',
      term ? (
        <>
          {term.range}
          <span className={styles.factMeta}>{term.length}</span>
        </>
      ) : (
        '—'
      ),
    ],
    [
      'Rent',
      rent ? (
        <>
          {formatMoney(rent)}
          <span className={styles.factMeta}>Monthly, due the {ordinal(draft.rentDueDay)}</span>
        </>
      ) : (
        '—'
      ),
    ],
    ['Deposit', deposit === null ? '—' : formatMoney(deposit)],
    ['Due at move-in', due === null ? '—' : formatMoney(due)],
    [
      'Tenants',
      selected.length ? (
        <ul className={styles.factList}>
          {selected.map((tenant) => (
            <li key={tenant.id}>
              {tenant.name}
              {tenant.id === draft.primaryTenantId && (
                <span className={styles.factTag}>Primary</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        '—'
      ),
    ],
    ['Template', draft.template ? `${draft.template.name} · v${draft.template.version}` : '—'],
    ['Files', fileCount ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : 'None'],
  ];
  return (
    <aside className={cx(styles.summary, open && styles.summaryOpen)} aria-label="Lease summary">
      <button
        type="button"
        className={styles.summaryToggle}
        aria-expanded={open}
        aria-controls="lease-summary-facts"
        onClick={onToggle}
      >
        <span className={styles.summaryToggleTitle}>Summary</span>
        <span className={styles.summaryToggleMeta}>
          {[rent ? `${formatMoney(rent)}/mo` : null, term?.range].filter(Boolean).join(' · ') ||
            placeLabel}
        </span>
        <Glyph name="chevron" className={styles.chevron} />
      </button>
      <h2 className={styles.summaryTitle}>Lease summary</h2>
      <dl className={styles.facts} id="lease-summary-facts">
        {facts.map(([label, value]) => (
          <div key={label} className={styles.fact}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
