'use client';

import { cloneElement, useId, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { FileUploader, type UploadedDocument } from '@/components/upload';
import {
  CLAUSE_OPTIONS,
  DISCLOSURE_OPTIONS,
  OPTION_CHOICES,
  RULE_OPTIONS,
  clauseLabels,
  disclosureLabels,
  optionLabels,
  ruleLabels,
} from '@/lib/lease-create/clauses';
import { feesFromDraft } from '@/lib/lease-create/fees';
import type { ResolvedTerm, TemplateSection } from '@/lib/lease-create/templates';
import {
  STEP,
  type TenantOption,
  type WizardDraft,
  type WizardErrors,
} from '@/lib/lease-create/types';
import { endOptionDates, validateReview } from '@/lib/lease-create/validation';
import { parseLeaseDate } from '@/lib/leases/core';
import { prorateFirstMonth } from '@/lib/ledger/lease-setup';
import { formatMoney } from '@/lib/ledger/statement';
import { Glyph } from './icons';
import { StatusTag } from './StatusTag';
import styles from './lease-builder.module.css';
import {
  blanksIn,
  chargesPreview,
  cx,
  draftTerms,
  dueAtMoveIn,
  fieldName,
  initials,
  longDate,
  mediumDate,
  moneyText,
  monthYear,
  ordinal,
  shortDate,
  splitMoveIn,
  termFacts,
  type TermFacts,
} from './summary';

export type StepProps = {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  errors: WizardErrors;
};

type ControlProps = {
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Label, control (with an optional "$" adornment), then hint and error as its description. */
function Field({
  label,
  hint,
  error,
  optional,
  prefix,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  prefix?: string;
  className?: string;
  children: ReactElement<ControlProps>;
}) {
  const id = useId();
  const controlId = children.props.id ?? `${id}control`;
  const helpId = `${id}help`;
  const control = cloneElement(children, {
    id: controlId,
    className: cx(styles.input, children.props.className),
    'aria-invalid': Boolean(error),
    'aria-describedby': hint || error ? helpId : undefined,
  });
  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
        {optional && <span className={styles.optional}>Optional</span>}
      </label>
      {prefix ? (
        <span className={styles.adorned}>
          <span className={styles.prefix} aria-hidden="true">
            {prefix}
          </span>
          {control}
        </span>
      ) : (
        control
      )}
      {(hint || error) && (
        <span id={helpId} className={styles.help}>
          {hint && <span>{hint}</span>}
          {error && <span className={styles.error}>{error}</span>}
        </span>
      )}
    </div>
  );
}

/** An on/off row: a label (and short detail) with a switch; revealed content follows it. */
function ToggleRow({
  label,
  detail,
  checked,
  onChange,
  aside,
  children,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={cx(styles.row, checked && styles.rowOn)}>
      <div className={styles.rowHead}>
        <span className={styles.rowText}>
          <label className={styles.rowLabel} htmlFor={id}>
            {label}
          </label>
          {detail && (
            <span className={styles.rowDetail} id={`${id}detail`}>
              {detail}
            </span>
          )}
        </span>
        {aside}
        <input
          id={id}
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={checked}
          aria-describedby={detail ? `${id}detail` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
      </div>
      {children}
    </div>
  );
}

/** A compact "$" amount for a row; its label is read by assistive tech, not shown. */
function Amount({
  label,
  value,
  onChange,
  error,
  errorId,
  placeholder = '0.00',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  errorId?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <span className={styles.amount}>
      <label className={styles.srOnly} htmlFor={id}>
        {label}
      </label>
      <span className={styles.adorned}>
        <span className={styles.prefix} aria-hidden="true">
          $
        </span>
        <input
          id={id}
          className={styles.input}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </span>
  );
}

/** A fee that is switched on before its amount is asked for. */
function FeeRow({
  label,
  detail,
  enabled,
  onToggle,
  amountLabel,
  value,
  onValue,
  error,
  placeholder,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  amountLabel: string;
  value: string;
  onValue: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const errorId = useId();
  return (
    <ToggleRow
      label={label}
      detail={detail}
      checked={enabled}
      onChange={onToggle}
      aside={
        enabled && (
          <Amount
            label={amountLabel}
            value={value}
            onChange={onValue}
            error={error}
            errorId={errorId}
            placeholder={placeholder}
          />
        )
      }
    >
      {enabled && error && (
        <small id={errorId} className={cx(styles.error, styles.rowError)}>
          {error}
        </small>
      )}
    </ToggleRow>
  );
}

/** A fee amount kept with the agreement wording; blank leaves it to the agreement. */
function AmountRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.rowText}>
          <label className={styles.rowLabel} htmlFor={id}>
            {label}
          </label>
          <span className={styles.rowDetail}>{detail}</span>
        </span>
        <span className={styles.amount}>
          <span className={styles.adorned}>
            <span className={styles.prefix} aria-hidden="true">
              $
            </span>
            <input
              id={id}
              className={styles.input}
              inputMode="decimal"
              value={value}
              placeholder="0.00"
              onChange={(event) => onChange(event.target.value)}
            />
          </span>
        </span>
      </div>
    </div>
  );
}

/** Wording with unfilled {{placeholders}} shown as small named blanks. */
function Wording({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{[a-z_]+\}\})/g).map((part, index) =>
        /^\{\{[a-z_]+\}\}$/.test(part) ? (
          <mark key={index} className={styles.blank}>
            {fieldName(part.slice(2, -2))}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------ 1. Lease term

const END_OPTIONS = [
  { value: 'full-year', title: 'Full year', detail: '12-month fixed term' },
  { value: 'month-to-month', title: 'Month-to-month', detail: 'Renews each month' },
  { value: 'custom', title: 'Custom end date', detail: 'Shorter or longer term' },
] as const;

/** Start ●──── length ────● end, under the term choices. */
function Timeline({ term, monthly }: { term: NonNullable<TermFacts>; monthly: boolean }) {
  return (
    <div
      className={styles.timeline}
      role="img"
      aria-label={
        monthly
          ? `Month-to-month from ${longDate(term.start)}`
          : `${term.length}, ${longDate(term.start)} to ${longDate(term.end)}`
      }
    >
      <div className={styles.timelineTrack}>
        <span className={styles.timelineDot} />
        <span className={cx(styles.timelineLine, monthly && styles.timelineOpen)}>
          <span className={styles.timelineLabel}>{term.length}</span>
        </span>
        <span className={cx(styles.timelineDot, monthly && styles.timelineEnd)} />
      </div>
      <div className={styles.timelineDates}>
        <span>{mediumDate(term.start)}</span>
        <span>{monthly ? `First period ends ${shortDate(term.end)}` : mediumDate(term.end)}</span>
      </div>
    </div>
  );
}

export function TermStep({ draft, update, errors }: StepProps) {
  const id = useId();
  const dates = endOptionDates(draft.startDate);
  const term = termFacts(draft);
  const custom = draft.endOption === 'custom';
  const pick = (endOption: WizardDraft['endOption']) =>
    update({
      endOption,
      customEndDate: draft.customEndDate || (endOption === 'custom' ? dates.fullYear : ''),
    });
  const long = (iso: string) => {
    const date = parseLeaseDate(iso);
    return date ? longDate(date) : '';
  };
  const endText: Record<WizardDraft['endOption'], string> = {
    'full-year': dates.fullYear ? `Ends ${long(dates.fullYear)}` : '',
    'month-to-month': dates.monthToMonth ? `First period ends ${long(dates.monthToMonth)}` : '',
    custom: custom ? '' : 'Choose a date',
  };
  return (
    <div className={styles.fields}>
      <Field label="Start date" error={errors.startDate} className={styles.dateField}>
        <input
          type="date"
          value={draft.startDate}
          onInput={(e) => update({ startDate: e.currentTarget.value })}
        />
      </Field>
      <fieldset
        className={styles.choices}
        aria-describedby={errors.endDate && !custom ? `${id}end-error` : undefined}
      >
        <legend className={styles.label}>End date</legend>
        {END_OPTIONS.map((option) => {
          const on = draft.endOption === option.value;
          const key = `${id}${option.value}`;
          return (
            <div key={option.value} className={cx(styles.choice, on && styles.choiceOn)}>
              <label className={styles.choiceMain}>
                <input
                  type="radio"
                  name="endOption"
                  checked={on}
                  onChange={() => pick(option.value)}
                  aria-labelledby={`${key}title`}
                  aria-describedby={`${key}detail ${key}date`}
                />
                <span className={styles.choiceText}>
                  <span className={styles.choiceTitle} id={`${key}title`}>
                    {option.title}
                  </span>
                  <span className={styles.choiceDetail} id={`${key}detail`}>
                    {option.detail}
                  </span>
                </span>
                <span className={styles.choiceDate} id={`${key}date`}>
                  {endText[option.value]}
                </span>
              </label>
              {option.value === 'custom' && on && (
                <div className={styles.choiceExtra}>
                  <label className={styles.label} htmlFor="custom-end-date">
                    End date
                  </label>
                  <input
                    id="custom-end-date"
                    className={cx(styles.input, styles.dateInput)}
                    type="date"
                    aria-invalid={Boolean(errors.endDate)}
                    aria-describedby={errors.endDate ? 'custom-end-date-error' : undefined}
                    value={draft.customEndDate}
                    onChange={(e) => update({ endOption: 'custom', customEndDate: e.target.value })}
                  />
                  {errors.endDate && (
                    <small id="custom-end-date-error" className={styles.error}>
                      {errors.endDate}
                    </small>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {errors.endDate && !custom && (
          <small id={`${id}end-error`} className={styles.error}>
            {errors.endDate}
          </small>
        )}
      </fieldset>
      {term && <Timeline term={term} monthly={draft.endOption === 'month-to-month'} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------ 2. Rent

/** The Payments ledger preview as a receipt: everything due at move-in, then the rent that repeats. */
export function ChargesPreview({ draft }: { draft: WizardDraft }) {
  const preview = useMemo(() => chargesPreview(draft), [draft]);
  const term = termFacts(draft);
  if (!term || !preview || (!preview.moveIn.length && !preview.monthly.length))
    return (
      <div className={styles.receipt}>
        <h3 className={styles.receiptTitle}>Scheduled charges preview</h3>
        <p className={styles.receiptEmpty}>
          Enter the rent and lease dates to preview the charges.
        </p>
      </div>
    );
  const moveIn = splitMoveIn(preview, term.start);
  const next = moveIn.recurring[0];
  const last = moveIn.recurring.at(-1);
  return (
    <div className={styles.receipt} data-testid="charges-preview">
      <h3 className={styles.receiptTitle}>Scheduled charges preview</h3>
      {moveIn.rows.length > 0 && (
        <>
          <ul className={styles.receiptRows}>
            {moveIn.rows.map((row) => (
              <li key={row.label} className={styles.receiptRow}>
                <span className={styles.receiptDate}>{shortDate(row.date)}</span>
                <span className={styles.receiptItem}>{row.label}</span>
                <span className={styles.money}>{formatMoney(row.amountCents)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.receiptTotal}>
            <span>Due at move-in</span>
            <span className={styles.money}>{formatMoney(moveIn.totalCents)}</span>
          </p>
        </>
      )}
      {next && last && (
        <p className={cx(styles.receiptRow, styles.receiptRepeat)}>
          <span className={styles.receiptDate}>{shortDate(next.date)}</span>
          <span className={styles.receiptItem}>
            Monthly rent
            {moveIn.recurring.length > 1
              ? ` · repeats on the ${ordinal(draft.rentDueDay)} through ${monthYear(last.date)}`
              : ''}
          </span>
          <span className={styles.money}>{formatMoney(next.amountCents)}</span>
        </p>
      )}
      <p className={styles.receiptNote}>
        Preview only. Charges are created when the lease is sent or activated.
      </p>
    </div>
  );
}

export function RentStep({ draft, update, errors }: StepProps) {
  const id = useId();
  const start = parseLeaseDate(draft.startDate);
  const end = parseLeaseDate(draft.endDate);
  const fees = feesFromDraft(draft);
  const proration =
    start && fees.monthlyRentCents > 0
      ? prorateFirstMonth(start, fees.monthlyRentCents, end ?? undefined, draft.rentDueDay)
      : null;
  const firstFullRent = proration ? new Date(proration.to.getTime() + 86_400_000) : null;
  return (
    <div className={styles.fields}>
      <div className={styles.two}>
        <Field label="Monthly rent" prefix="$" error={errors.monthlyRent}>
          <input
            inputMode="decimal"
            value={draft.monthlyRent}
            placeholder="0.00"
            onChange={(e) => update({ monthlyRent: e.target.value })}
          />
        </Field>
        <Field label="Security deposit" prefix="$" error={errors.deposit}>
          <input
            inputMode="decimal"
            value={draft.deposit}
            placeholder="0.00"
            onChange={(e) => update({ deposit: e.target.value })}
          />
        </Field>
        <Field label="Rent due day" error={errors.rentDueDay}>
          <select
            className={styles.select}
            value={draft.rentDueDay}
            onChange={(e) => update({ rentDueDay: Number(e.target.value) })}
          >
            {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {ordinal(day)} of each month
              </option>
            ))}
          </select>
        </Field>
        <div className={styles.field}>
          <span className={styles.label}>First month</span>
          <div className={cx(styles.firstMonth, !proration && styles.firstMonthStatic)}>
            {proration ? (
              <>
                <label className={styles.firstMonthText} htmlFor={`${id}prorate`}>
                  {draft.prorateFirstMonth ? (
                    <>
                      Prorated <strong>{formatMoney(proration.cents)}</strong>
                    </>
                  ) : (
                    `Full rent from ${shortDate(firstFullRent!)}`
                  )}
                </label>
                <input
                  id={`${id}prorate`}
                  type="checkbox"
                  role="switch"
                  className={styles.switch}
                  aria-label="Prorate first month"
                  aria-describedby={`${id}period`}
                  checked={draft.prorateFirstMonth}
                  onChange={(e) => update({ prorateFirstMonth: e.target.checked })}
                />
              </>
            ) : (
              <span className={styles.firstMonthText}>
                {start && fees.monthlyRentCents > 0 ? 'Full month' : '—'}
              </span>
            )}
          </div>
          {proration && (
            <span className={styles.help} id={`${id}period`}>
              {shortDate(proration.from)} – {shortDate(proration.to)} · {proration.days} of{' '}
              {proration.daysInMonth} days
            </span>
          )}
        </div>
      </div>

      <section className={styles.group} aria-labelledby={`${id}fees`}>
        <h3 className={styles.groupTitle} id={`${id}fees`}>
          Fees
        </h3>
        <div className={styles.rows}>
          <FeeRow
            label="Move-in fee"
            detail="One-time, due at move-in"
            enabled={draft.moveInFeeEnabled}
            onToggle={(moveInFeeEnabled) => update({ moveInFeeEnabled })}
            amountLabel="Move-in fee amount"
            value={draft.moveInFee}
            onValue={(moveInFee) => update({ moveInFee })}
            error={errors.moveInFee}
            placeholder="150.00"
          />
          <FeeRow
            label="Pet deposit"
            detail="Refundable, due at move-in"
            enabled={draft.petDepositEnabled}
            onToggle={(petDepositEnabled) => update({ petDepositEnabled })}
            amountLabel="Pet deposit amount"
            value={draft.petDeposit}
            onValue={(petDeposit) => update({ petDeposit })}
            error={errors.petDeposit}
            placeholder="250.00"
          />
          <ToggleRow
            label="Late fee"
            detail="Charged when rent is late"
            checked={draft.lateFeeEnabled}
            onChange={(lateFeeEnabled) => update({ lateFeeEnabled })}
          >
            {draft.lateFeeEnabled && (
              <>
                <div className={styles.lateRule}>
                  <span>Charge</span>
                  <Amount
                    label="Late fee amount"
                    value={draft.lateFee}
                    onChange={(lateFee) => update({ lateFee })}
                    error={errors.lateFee}
                    errorId={`${id}late-error`}
                  />
                  <span>after</span>
                  <span>
                    <label className={styles.srOnly} htmlFor={`${id}grace`}>
                      Late fee grace period (days)
                    </label>
                    <input
                      id={`${id}grace`}
                      className={cx(styles.input, styles.days)}
                      type="number"
                      min={0}
                      max={31}
                      value={draft.graceDays}
                      aria-invalid={Boolean(errors.graceDays)}
                      aria-describedby={errors.graceDays ? `${id}grace-error` : undefined}
                      onChange={(e) => update({ graceDays: Number(e.target.value) })}
                    />
                  </span>
                  <span>grace days</span>
                </div>
                {errors.lateFee && (
                  <small id={`${id}late-error`} className={cx(styles.error, styles.rowError)}>
                    {errors.lateFee}
                  </small>
                )}
                {errors.graceDays && (
                  <small id={`${id}grace-error`} className={cx(styles.error, styles.rowError)}>
                    {errors.graceDays}
                  </small>
                )}
              </>
            )}
          </ToggleRow>
          <AmountRow
            label="Returned payment fee"
            detail="Per returned payment"
            value={draft.returnedPaymentFee}
            onChange={(returnedPaymentFee) => update({ returnedPaymentFee })}
          />
          <AmountRow
            label="Key replacement fee"
            detail="Per key"
            value={draft.keyFee}
            onChange={(keyFee) => update({ keyFee })}
          />
        </div>
      </section>

      <ChargesPreview draft={draft} />
    </div>
  );
}

// ------------------------------------------------------------------------------------ 3. Tenants

export type ApplicantOption = {
  id: string;
  name: string;
  email: string;
  status: string;
  tenantId?: string;
};

export function TenantsStep({
  draft,
  update,
  errors,
  tenants,
  sourceLabel,
  notice,
  noticeApplicantId,
  applicants = [],
  applicationsHref = (applicantId) =>
    `/applications?${new URLSearchParams({
      unitId: draft.unitId,
      ...(applicantId ? { applicant: applicantId } : {}),
    })}${applicantId ? '#selected-applicant' : ''}`,
  onReviewApplicants,
}: StepProps & {
  tenants: TenantOption[];
  sourceLabel?: string;
  notice?: string;
  noticeApplicantId?: string;
  applicants?: ApplicantOption[];
  /** Builds the Applications link scoped to this lease's property and unit. */
  applicationsHref?: (applicantId?: string) => string;
  /** Saves the draft before leaving for Applications; plain clicks only. */
  onReviewApplicants?: (href: string) => void;
}) {
  // Tenants are created only by promoting an approved applicant, never by hand from the wizard.
  const reviewLink = (href: string, label: string, ariaLabel?: string) => (
    <a
      href={href}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!onReviewApplicants || event.metaKey || event.ctrlKey || event.shiftKey) return;
        if (event.button !== 0) return;
        event.preventDefault();
        onReviewApplicants(href);
      }}
    >
      {label}
    </a>
  );
  const id = useId();
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const selected = draft.tenantIds.flatMap((tenantId) => tenants.filter((t) => t.id === tenantId));
  const matches =
    query.length >= 2
      ? tenants.filter((tenant) =>
          `${tenant.name} ${tenant.email ?? ''}`.toLowerCase().includes(query),
        )
      : [];
  const unpromoted = applicants.some((applicant) => !applicant.tenantId);
  const toggle = (tenantId: string, checked: boolean) => {
    const tenantIds = checked
      ? [...draft.tenantIds.filter((t) => t !== tenantId), tenantId]
      : draft.tenantIds.filter((t) => t !== tenantId);
    update({
      tenantIds,
      primaryTenantId:
        draft.primaryTenantId && tenantIds.includes(draft.primaryTenantId)
          ? draft.primaryTenantId
          : (tenantIds[0] ?? ''),
    });
  };
  const selectionError = errors.tenantIds ? 'tenant-selection-error' : undefined;
  return (
    <div className={styles.fields}>
      {sourceLabel && <p className={styles.note}>Renewing {sourceLabel}</p>}
      {notice && (
        <p className={cx(styles.note, styles.noteWarn)}>
          <Glyph name="alert" className={styles.noteIcon} />
          <span>
            {notice}{' '}
            {noticeApplicantId &&
              reviewLink(applicationsHref(noticeApplicantId), 'Review application')}
          </span>
        </p>
      )}

      <section className={styles.group} aria-labelledby={`${id}selected`}>
        <h3 className={styles.groupTitle} id={`${id}selected`}>
          On this lease
          {selected.length > 0 && <span className={styles.countPill}>{selected.length}</span>}
        </h3>
        {selected.length ? (
          <ul className={styles.people} aria-label="Selected tenants">
            {selected.map((tenant) => (
              <li key={tenant.id} className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(tenant.name)}
                </span>
                <span className={styles.personText}>
                  <span className={styles.personName}>{tenant.name}</span>
                  <span className={styles.personMeta}>{tenant.email ?? 'No email on file'}</span>
                </span>
                <label className={styles.primaryPick}>
                  <input
                    type="radio"
                    name="primary-tenant"
                    value={tenant.id}
                    checked={draft.primaryTenantId === tenant.id}
                    aria-label={`Primary tenant: ${tenant.name}`}
                    aria-describedby={errors.primaryTenantId ? `${id}primary-error` : undefined}
                    onChange={() => update({ primaryTenantId: tenant.id })}
                  />
                  <span aria-hidden="true">Primary</span>
                </label>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => toggle(tenant.id, false)}
                  aria-label={`Remove ${tenant.name}`}
                >
                  <Glyph name="close" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyRow}>No tenants on this lease yet</p>
        )}
        {errors.primaryTenantId && (
          <small id={`${id}primary-error`} className={styles.error}>
            {errors.primaryTenantId}
          </small>
        )}
      </section>

      <div className={styles.group}>
        <label className={styles.label} htmlFor={`${id}search`}>
          Search existing tenants
        </label>
        <span className={styles.searchBox}>
          <Glyph name="search" className={styles.searchIcon} />
          <input
            id={`${id}search`}
            className={styles.input}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or email"
            aria-invalid={Boolean(errors.tenantIds)}
            aria-describedby={cx('tenant-search-help', selectionError) || undefined}
          />
        </span>
        <span id="tenant-search-help" className={styles.help}>
          {query.length < 2
            ? query.length === 1
              ? 'Type at least 2 characters.'
              : ''
            : matches.length > 8
              ? `${matches.length} matches · showing 8`
              : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`}
        </span>
        {matches.length > 0 && (
          <div
            className={styles.results}
            role="group"
            aria-label="Matching tenants"
            aria-describedby={selectionError}
          >
            {matches.slice(0, 8).map((tenant) => {
              const on = draft.tenantIds.includes(tenant.id);
              return (
                <label key={tenant.id} className={cx(styles.result, on && styles.resultOn)}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initials(tenant.name)}
                  </span>
                  <span className={styles.personText}>
                    <span className={styles.personName}>{tenant.name}</span>
                    <span className={styles.personMeta}>{tenant.email ?? 'No email on file'}</span>
                  </span>
                  <input
                    type="checkbox"
                    className={styles.addToggle}
                    checked={on}
                    onChange={(event) => toggle(tenant.id, event.target.checked)}
                  />
                </label>
              );
            })}
          </div>
        )}
        {!tenants.length && (
          <p className={styles.emptyRow}>
            No tenants yet. Promote an approved applicant to add one.
          </p>
        )}
        {errors.tenantIds && (
          <small id="tenant-selection-error" className={styles.error}>
            {errors.tenantIds}
          </small>
        )}
      </div>

      {applicants.length > 0 && (
        <section className={styles.group} aria-labelledby={`${id}applicants`}>
          <h3 className={styles.groupTitle} id={`${id}applicants`}>
            Applicants for this unit
          </h3>
          {unpromoted && (
            <p className={styles.groupHint}>Promote an approved applicant to add them.</p>
          )}
          <ul className={styles.applicants}>
            {applicants.map((applicant) => (
              <li key={applicant.id} className={styles.applicant}>
                {applicant.tenantId ? (
                  <label className={styles.applicantName}>
                    <input
                      type="checkbox"
                      checked={draft.tenantIds.includes(applicant.tenantId)}
                      onChange={(event) => toggle(applicant.tenantId!, event.target.checked)}
                    />
                    <span>{applicant.name}</span>
                  </label>
                ) : (
                  <span className={styles.applicantName}>{applicant.name}</span>
                )}
                <StatusTag tone={applicant.status === 'Approved' ? 'ok' : 'info'}>
                  {applicant.status}
                </StatusTag>
                {!applicant.tenantId && (
                  <span className={styles.applicantAction}>
                    {reviewLink(
                      applicationsHref(applicant.id),
                      'Review',
                      `Review ${applicant.name}'s application`,
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.footNote}>
        Someone new? {reviewLink(applicationsHref(), 'Review applicants for this unit')}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 4. Options

const FEATURES = [
  ['assignedParking', 'Assigned parking'],
  ['balconyPatio', 'Balcony or patio'],
  ['sharedLaundry', 'Shared laundry'],
  ['floodZone', 'Flood zone'],
] as const;
const UTILITIES = ['Electricity', 'Gas', 'Water', 'Trash', 'Internet'];

export function OptionsStep({ draft, update, errors }: StepProps) {
  const id = useId();
  const toggleIn = (list: string[], value: string, on: boolean) =>
    on ? [...list.filter((item) => item !== value), value] : list.filter((item) => item !== value);
  return (
    <div className={styles.fields}>
      <div className={styles.two}>
        <fieldset
          className={styles.field}
          aria-describedby={errors.renewalNoticeDays ? `${id}notice-error` : undefined}
        >
          <legend className={styles.label}>Renewal notice</legend>
          <span className={styles.segmented}>
            {[30, 60, 90].map((days) => (
              <label
                key={days}
                className={cx(styles.segment, draft.renewalNoticeDays === days && styles.segmentOn)}
              >
                <input
                  type="radio"
                  name="renewalNoticeDays"
                  value={days}
                  checked={draft.renewalNoticeDays === days}
                  onChange={() => update({ renewalNoticeDays: days })}
                />
                <span>{days} days</span>
              </label>
            ))}
          </span>
          {errors.renewalNoticeDays && (
            <small id={`${id}notice-error`} className={styles.error}>
              {errors.renewalNoticeDays}
            </small>
          )}
        </fieldset>
        <Field label="Occupants" optional error={errors.occupants}>
          <input
            value={draft.occupants}
            placeholder="Everyone who will live in the unit"
            onChange={(e) => update({ occupants: e.target.value })}
          />
        </Field>
      </div>

      <section className={styles.group} aria-labelledby={`${id}options`}>
        <h3 className={styles.groupTitle} id={`${id}options`}>
          Lease options
        </h3>
        <div className={styles.rows}>
          {OPTION_CHOICES.map((option) => (
            <ToggleRow
              key={option.id}
              label={option.label}
              checked={draft.options.includes(option.id)}
              onChange={(on) => update({ options: toggleIn(draft.options, option.id, on) })}
            />
          ))}
        </div>
        {errors.options && <small className={styles.error}>{errors.options}</small>}
      </section>

      <section className={styles.group} aria-labelledby={`${id}features`}>
        <h3 className={styles.groupTitle} id={`${id}features`}>
          Property features
        </h3>
        <p className={styles.groupHint}>Adds the matching rules and disclosures.</p>
        <div className={styles.rows}>
          {FEATURES.map(([key, label]) => (
            <ToggleRow
              key={key}
              label={label}
              checked={draft[key]}
              onChange={(on) => update({ [key]: on })}
            />
          ))}
        </div>
      </section>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Utilities paid by tenant</legend>
        <span className={styles.chipSet}>
          {UTILITIES.map((utility) => {
            const on = draft.tenantUtilities.includes(utility);
            return (
              <label key={utility} className={cx(styles.chipToggle, on && styles.chipToggleOn)}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    update({
                      tenantUtilities: toggleIn(draft.tenantUtilities, utility, e.target.checked),
                    })
                  }
                />
                {on && <Glyph name="check" className={styles.chipCheck} />}
                {utility}
              </label>
            );
          })}
        </span>
      </fieldset>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 8. Attachments

export type LeaseDocumentType = 'LEASE' | 'ADDENDUM' | 'DISCLOSURE' | 'OTHER';
export type AttachmentFile = {
  id: string;
  name: string;
  sizeBytes: number;
  kind: LeaseDocumentType;
};

export function AttachmentsStep({
  leaseId,
  files,
  onUploaded,
  onRemoved,
  onKindChanged,
}: {
  leaseId: string | null;
  files: AttachmentFile[];
  onUploaded: (file: AttachmentFile) => void;
  onRemoved: (id: string) => void;
  onKindChanged: (id: string, kind: LeaseDocumentType) => void;
}) {
  const [typeError, setTypeError] = useState('');
  const [savingType, setSavingType] = useState<string | null>(null);
  if (!leaseId) return <p className={styles.emptyRow}>Save the draft first to add files.</p>;
  return (
    <div className={cx(styles.fields, styles.attachments)}>
      {typeError && (
        <p className={styles.inlineAlert} role="alert">
          {typeError}
        </p>
      )}
      <FileUploader
        key={leaseId}
        kind="document"
        documentKind="LEASE"
        target={{ kind: 'lease', id: leaseId }}
        initialFiles={files}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif"
        label="Lease documents"
        renderItemAction={(item) => {
          const id = item.document?.id;
          if (typeof id !== 'string') return null;
          const file = files.find((candidate) => candidate.id === id);
          return (
            <select
              className={styles.documentType}
              aria-label={`Type for ${item.name}`}
              value={file?.kind ?? 'LEASE'}
              disabled={savingType !== null}
              onChange={async (event) => {
                const kind = event.target.value as LeaseDocumentType;
                setTypeError('');
                setSavingType(id);
                try {
                  const response = await fetch(`/api/files/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind }),
                  });
                  if (response.ok) onKindChanged(id, kind);
                  else
                    setTypeError(`The type for ${item.name} could not be saved. Please try again.`);
                } catch {
                  setTypeError(
                    `The type for ${item.name} could not be saved. Check your connection and try again.`,
                  );
                } finally {
                  setSavingType(null);
                }
              }}
            >
              <option value="LEASE">Lease agreement</option>
              <option value="ADDENDUM">Addendum</option>
              <option value="DISCLOSURE">Disclosure</option>
              <option value="OTHER">Other</option>
            </select>
          );
        }}
        onUploaded={(doc: UploadedDocument) => {
          if (typeof doc.id === 'string')
            onUploaded({
              id: doc.id,
              name: typeof doc.name === 'string' ? doc.name : 'Document',
              sizeBytes: typeof doc.sizeBytes === 'number' ? doc.sizeBytes : 0,
              kind: 'LEASE',
            });
        }}
        onRemove={async (item) => {
          const id = item.document?.id;
          if (!id) return;
          const response = await fetch(`/api/files/${id}`, { method: 'DELETE' });
          if (!response.ok && response.status !== 404)
            throw new Error('The file could not be removed.');
          onRemoved(id);
        }}
      />
      <p className={styles.footNote}>Only addenda are signed with the lease.</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 9. Lessor

export function LessorStep({
  draft,
  update,
  errors,
  lessorSigner,
}: StepProps & { lessorSigner?: { name: string; email: string } | null }) {
  return (
    <div className={styles.fields}>
      <div className={styles.two}>
        <Field label="Lessor name" error={errors.lessorName} className={styles.span2}>
          <input
            autoComplete="organization"
            value={draft.lessorName}
            onChange={(e) => update({ lessorName: e.target.value })}
          />
        </Field>
        <Field label="Mailing address" error={errors.lessorAddress} className={styles.span2}>
          <input
            autoComplete="street-address"
            value={draft.lessorAddress}
            onChange={(e) => update({ lessorAddress: e.target.value })}
          />
        </Field>
        <Field label="Email" optional error={errors.lessorEmail}>
          <input
            type="email"
            autoComplete="email"
            value={draft.lessorEmail}
            onChange={(e) => update({ lessorEmail: e.target.value })}
          />
        </Field>
        <Field label="Phone" optional>
          <input
            type="tel"
            autoComplete="tel"
            value={draft.lessorPhone}
            onChange={(e) => update({ lessorPhone: e.target.value })}
          />
        </Field>
      </div>
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>Signs for the lessor</h3>
        {lessorSigner ? (
          <p className={styles.person}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(lessorSigner.name)}
            </span>
            <span className={styles.personText}>
              <span className={styles.personName}>{lessorSigner.name}</span>
              <span className={styles.personMeta}>{lessorSigner.email}</span>
            </span>
          </p>
        ) : (
          <p className={cx(styles.note, styles.noteWarn)}>
            <Glyph name="alert" className={styles.noteIcon} />
            <span>No owner account on this property yet. Assign one before sending.</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 10. Review

const SECTIONS = [
  { section: 'CLAUSE', label: 'Clauses', step: STEP.clauses },
  { section: 'RULE', label: 'Rules', step: STEP.rules },
  { section: 'DISCLOSURE', label: 'Disclosures', step: STEP.disclosures },
] as const satisfies readonly { section: TemplateSection; label: string; step: number }[];

const LEGACY = [
  { label: 'Clauses', titles: (draft: WizardDraft) => clauseLabels(draft.clauses) },
  { label: 'Rules', titles: (draft: WizardDraft) => ruleLabels(draft.rules) },
  { label: 'Disclosures', titles: (draft: WizardDraft) => disclosureLabels(draft.disclosures) },
];

/** The agreement as the signers will read it, laid out as a page. */
function AgreementPaper({
  draft,
  unitLabel,
  term,
  included,
}: {
  draft: WizardDraft;
  unitLabel: string;
  term: TermFacts;
  included: ResolvedTerm[];
}) {
  const ordered = SECTIONS.flatMap(({ section }) => included.filter((t) => t.section === section));
  const extras = [
    ...OPTION_CHOICES.filter((c) => draft.options.includes(c.id)).map(
      (c) => ['option', c] as const,
    ),
    ...CLAUSE_OPTIONS.filter((c) => draft.clauses.includes(c.id)).map(
      (c) => ['clause', c] as const,
    ),
    ...RULE_OPTIONS.filter((c) => draft.rules.includes(c.id)).map((c) => ['rule', c] as const),
    ...DISCLOSURE_OPTIONS.filter((c) => draft.disclosures.includes(c.id)).map(
      (c) => ['disclosure', c] as const,
    ),
  ];
  return (
    <div className={styles.desk}>
      <article className={styles.paper} aria-label="Agreement wording">
        <header className={styles.paperHead}>
          <p className={styles.paperKind}>{draft.template?.name ?? 'Lease agreement'}</p>
          <h4 className={styles.paperTitle}>{unitLabel}</h4>
          <p className={styles.paperMeta}>{term ? term.range : 'Dates not set'}</p>
        </header>
        {SECTIONS.map(({ section, label }) => {
          const items = ordered.filter((t) => t.section === section);
          if (!items.length) return null;
          return (
            <section key={section} className={styles.paperSection}>
              <h5 className={styles.paperGroup}>{label}</h5>
              {items.map((t) => (
                <div key={t.id} className={styles.paperItem}>
                  <h6 className={styles.paperItemTitle}>
                    <span className={styles.paperNumber}>{ordered.indexOf(t) + 1}.</span>
                    {t.title}
                  </h6>
                  <p className={styles.paperText}>
                    <Wording text={t.body} />
                  </p>
                </div>
              ))}
            </section>
          );
        })}
        {(extras.length > 0 || draft.customClause || draft.customRules) && (
          <section className={styles.paperSection}>
            <h5 className={styles.paperGroup}>Additional terms</h5>
            {extras.map(([group, choice]) => (
              <div key={`${group}-${choice.id}`} className={styles.paperItem}>
                <h6 className={styles.paperItemTitle}>{choice.label}</h6>
                <p className={styles.paperText}>{choice.description}</p>
              </div>
            ))}
            {draft.customClause && <p className={styles.paperText}>{draft.customClause}</p>}
            {draft.customRules && <p className={styles.paperText}>{draft.customRules}</p>}
          </section>
        )}
      </article>
    </div>
  );
}

export function ReviewStep({
  draft,
  errors,
  unitLabel,
  tenants,
  attachments,
  lessorSigner,
  isRenewal = false,
  onJump,
}: {
  draft: WizardDraft;
  errors: WizardErrors;
  unitLabel: string;
  tenants: TenantOption[];
  attachments: AttachmentFile[];
  lessorSigner?: { name: string; email: string } | null;
  isRenewal?: boolean;
  /** Opens an earlier step to fix what the checklist flags. */
  onJump?: (step: number) => void;
}) {
  const id = useId();
  const term = termFacts(draft);
  const due = dueAtMoveIn(draft);
  const selected = draft.tenantIds.flatMap((tenantId) => tenants.filter((t) => t.id === tenantId));
  const included = draftTerms(draft).filter((t) => t.included);
  const groups = draft.template
    ? SECTIONS.map(({ section, label, step }) => {
        const items = included.filter((t) => t.section === section);
        return {
          label,
          step,
          titles: items.map((t) => t.title),
          blanks: items.reduce((sum, t) => sum + blanksIn(t.body).length, 0),
        };
      })
    : LEGACY.map(({ label, titles }) => ({
        label,
        step: STEP.clauses,
        titles: titles(draft),
        blanks: 0,
      }));
  const blanks = groups.reduce((sum, group) => sum + group.blanks, 0);
  const firstBlank = groups.find((group) => group.blanks > 0);
  const options = optionLabels(draft.options);
  const problems: WizardErrors = { ...validateReview(draft, { tenants, isRenewal }), ...errors };
  const issue = (...fields: string[]) => fields.map((field) => problems[field]).find(Boolean);
  const checks: { done: string; issue?: string; step?: number; action?: string; verb?: string }[] =
    [
      {
        done: 'Term set',
        issue: issue('startDate', 'endDate'),
        step: STEP.term,
        action: 'Edit lease term',
      },
      {
        done: 'Rent and deposit set',
        issue: issue(
          'monthlyRent',
          'deposit',
          'rentDueDay',
          'lateFee',
          'graceDays',
          'moveInFee',
          'petDeposit',
        ),
        step: STEP.rent,
        action: 'Edit rent and fees',
      },
      {
        done: `${count(selected.length, 'tenant')} will sign`,
        issue: issue('unitId', 'tenantIds', 'primaryTenantId'),
        step: STEP.tenants,
        action: 'Edit tenants',
      },
      {
        done: 'Agreement complete',
        issue: blanks
          ? `${count(blanks, 'blank')} to fill`
          : issue(
              'renewalNoticeDays',
              'options',
              'occupants',
              'clauses',
              'customClause',
              'rules',
              'customRules',
              'disclosures',
              'documentNames',
            ),
        step:
          firstBlank?.step ??
          (issue('renewalNoticeDays', 'options', 'occupants') ? STEP.options : STEP.clauses),
        action: firstBlank ? `Fill blanks in ${firstBlank.label.toLowerCase()}` : 'Edit agreement',
        verb: firstBlank ? 'Fill blanks' : undefined,
      },
      {
        done: 'Lessor set',
        issue: issue('lessorName', 'lessorAddress', 'lessorEmail'),
        step: STEP.lessor,
        action: 'Edit lessor info',
      },
      {
        done: 'Owner signer assigned',
        issue: lessorSigner
          ? undefined
          : 'Assign an owner / lessor account to this property before sending.',
      },
    ];
  const open = checks.filter((check) => check.issue).length;
  return (
    <div className={styles.review}>
      <section className={styles.reviewHero} aria-labelledby={`${id}place`}>
        <h3 className={styles.reviewPlace} id={`${id}place`}>
          {unitLabel}
        </h3>
        <p className={styles.reviewMeta}>
          {term ? `${term.range} · ${term.length}` : 'Dates not set'} · {draft.renewalNoticeDays}
          -day renewal notice
        </p>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Monthly rent</dt>
            <dd className={styles.statValue}>{moneyText(draft.monthlyRent)}</dd>
            <dd className={styles.statMeta}>Due on the {ordinal(draft.rentDueDay)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Security deposit</dt>
            <dd className={styles.statValue}>{moneyText(draft.deposit)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Due at move-in</dt>
            <dd className={styles.statValue}>{due === null ? '—' : formatMoney(due)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.reviewBlock} aria-labelledby={`${id}ready`}>
        <h3 className={styles.blockTitle} id={`${id}ready`}>
          {open ? `${count(open, 'item')} to finish` : 'Ready to send'}
        </h3>
        <ul className={styles.checklist}>
          {checks.map((check) => (
            <li key={check.done} className={cx(styles.checkItem, check.issue && styles.checkIssue)}>
              <span className={styles.checkMark} aria-hidden="true">
                <Glyph name={check.issue ? 'alert' : 'check'} />
              </span>
              <span className={styles.checkText}>
                <span className={styles.srOnly}>{check.issue ? 'To do: ' : 'Done: '}</span>
                {check.issue ?? check.done}
              </span>
              {check.issue && check.step !== undefined && onJump && (
                <button
                  type="button"
                  className={styles.textButton}
                  aria-label={check.action}
                  onClick={() => onJump(check.step!)}
                >
                  {check.verb ?? 'Edit'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.reviewSplit}>
        <div className={styles.reviewAside}>
          <ChargesPreview draft={draft} />
        </div>
        <div className={styles.reviewMain}>
          <section className={styles.reviewBlock} aria-labelledby={`${id}agreement`}>
            <div className={styles.blockHead}>
              <h3 className={styles.blockTitle} id={`${id}agreement`}>
                Agreement
              </h3>
              {draft.template && (
                <span className={styles.blockMeta}>
                  {draft.template.name} · v{draft.template.version}
                </span>
              )}
            </div>
            <div className={styles.disclosures}>
              {groups.map((group) => (
                <details key={group.label} className={styles.disclosure}>
                  <summary>
                    <span className={styles.disclosureLabel}>{group.label}</span>
                    {group.blanks > 0 && (
                      <span className={styles.blankBadge}>{count(group.blanks, 'blank')}</span>
                    )}
                    <span className={styles.disclosureCount}>{group.titles.length}</span>
                    <Glyph name="chevron" className={styles.chevron} />
                  </summary>
                  {group.titles.length ? (
                    <ol className={styles.titleList}>
                      {group.titles.map((title, index) => (
                        <li key={`${index}-${title}`}>{title}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.emptyRow}>None</p>
                  )}
                </details>
              ))}
              {options.length > 0 && (
                <details className={styles.disclosure}>
                  <summary>
                    <span className={styles.disclosureLabel}>Lease options</span>
                    <span className={styles.disclosureCount}>{options.length}</span>
                    <Glyph name="chevron" className={styles.chevron} />
                  </summary>
                  <ul className={styles.titleList}>
                    {options.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                </details>
              )}
              <details className={styles.disclosure}>
                <summary>
                  <span className={styles.disclosureLabel}>Attachments</span>
                  <span className={styles.disclosureCount}>{attachments.length}</span>
                  <Glyph name="chevron" className={styles.chevron} />
                </summary>
                {attachments.length ? (
                  <ul className={styles.files}>
                    {attachments.map((file) => (
                      <li key={file.id} className={styles.fileRow}>
                        <Glyph name="doc" className={styles.fileIcon} />
                        <span className={styles.personText}>
                          <span className={styles.personName}>{file.name}</span>
                          <span className={styles.personMeta}>
                            {file.kind === 'ADDENDUM'
                              ? 'Signed with the lease'
                              : 'Supporting document'}
                          </span>
                        </span>
                        <a href={`/api/files/${file.id}/preview`} target="_blank" rel="noreferrer">
                          Preview
                        </a>
                        <a href={`/api/files/${file.id}/download`}>Download</a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyRow}>None</p>
                )}
              </details>
            </div>
          </section>

          <section className={styles.reviewBlock} aria-labelledby={`${id}signers`}>
            <h3 className={styles.blockTitle} id={`${id}signers`}>
              Signers
            </h3>
            <ul className={styles.people}>
              {selected.map((tenant) => (
                <li key={tenant.id} className={styles.person}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initials(tenant.name)}
                  </span>
                  <span className={styles.personText}>
                    <span className={styles.personName}>{tenant.name}</span>
                    <span className={styles.personMeta}>
                      Tenant{tenant.id === draft.primaryTenantId ? ' · Primary' : ''}
                    </span>
                  </span>
                  <span className={cx(styles.personEmail, !tenant.email && styles.warnText)}>
                    {tenant.email || 'Email required'}
                  </span>
                </li>
              ))}
              <li className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">
                  {lessorSigner ? initials(lessorSigner.name) : '?'}
                </span>
                <span className={styles.personText}>
                  <span className={styles.personName}>
                    {lessorSigner?.name ?? 'No owner account'}
                  </span>
                  <span className={styles.personMeta}>Owner / lessor</span>
                </span>
                <span className={cx(styles.personEmail, !lessorSigner && styles.warnText)}>
                  {lessorSigner?.email ?? 'Assign before sending'}
                </span>
              </li>
            </ul>
            <p className={styles.footNote}>
              Lessor on the agreement: {draft.lessorName || '—'}
              {draft.lessorAddress ? ` · ${draft.lessorAddress}` : ''}
            </p>
          </section>
        </div>
      </div>

      <details className={styles.wording}>
        <summary>
          <span className={styles.disclosureLabel}>Full agreement wording</span>
          <span className={styles.disclosureCount}>
            {count(included.length || groups.reduce((n, g) => n + g.titles.length, 0), 'section')}
          </span>
          <Glyph name="chevron" className={styles.chevron} />
        </summary>
        <AgreementPaper draft={draft} unitLabel={unitLabel} term={term} included={included} />
      </details>

      <p className={styles.footNote}>
        Sending activates the lease and adds its charges to Payments. Templates may not fit every
        situation; verify the agreement with your advisors.
      </p>
    </div>
  );
}
