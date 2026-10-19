'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
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
  type ClauseOption,
} from '@/lib/lease-create/clauses';
import { feesFromDraft } from '@/lib/lease-create/fees';
import type { TenantOption, WizardDraft, WizardErrors } from '@/lib/lease-create/types';
import { dueAtSigning, endOptionDates, termLabel } from '@/lib/lease-create/validation';
import { parseLeaseDate } from '@/lib/leases/core';
import { previewScheduledCharges, prorateFirstMonth } from '@/lib/ledger/lease-setup';
import { formatMoney } from '@/lib/ledger/statement';
import styles from './lease-builder.module.css';
import { contextFromDraft, resolveTerms } from '@/lib/lease-create/templates';

export type StepProps = {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  errors: WizardErrors;
};

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

function Err({ errors, name }: { errors: WizardErrors; name: string }) {
  return errors[name] ? (
    <small className={styles.error} role="alert">
      {errors[name]}
    </small>
  ) : null;
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const descriptionId = useId();
  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>,
        {
          'aria-invalid': Boolean(error),
          'aria-describedby': hint || error ? descriptionId : undefined,
        },
      )
    : children;
  return (
    <label className={cx(styles.field, className)}>
      {label}
      {control}
      {(hint || error) && (
        <span id={descriptionId} className={styles.fieldHelp}>
          {hint ? <small>{hint}</small> : null}
          {error ? <small className={styles.error}>{error}</small> : null}
        </span>
      )}
    </label>
  );
}

function CheckList({
  options,
  selected,
  onChange,
  name,
}: {
  options: ClauseOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  name: string;
}) {
  return (
    <div className={styles.checks} role="group" aria-label={name}>
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <label key={option.id} className={cx(styles.check, on && styles.checkOn)}>
            <input
              type="checkbox"
              checked={on}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
            />
            <span className={styles.checkCopy}>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------------------------ 1. Lease term

const longDate = (isoDate: string) => {
  const parsed = parseLeaseDate(isoDate);
  return parsed
    ? parsed.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : isoDate;
};

export function TermStep({ draft, update, errors }: StepProps) {
  const dates = endOptionDates(draft.startDate);
  const pick = (endOption: WizardDraft['endOption']) =>
    update({
      endOption,
      customEndDate: draft.customEndDate || (endOption === 'custom' ? dates.fullYear : ''),
    });
  const startLabel = (() => {
    const parsed = parseLeaseDate(draft.startDate);
    return parsed
      ? parsed.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null;
  })();
  return (
    <div className={styles.fields}>
      <div className={styles.two}>
        <Field
          label="Start date"
          error={errors.startDate}
          hint="Move-in charges begin on this date."
        >
          <input
            type="date"
            value={draft.startDate}
            onInput={(e) => update({ startDate: e.currentTarget.value })}
          />
        </Field>
        <div className={styles.hintbar}>
          <span>
            {startLabel ? (
              <>
                Dates below are calculated from a <strong>{startLabel}</strong> start. Select a term
                to set the end date.
              </>
            ) : (
              'Select a start date to calculate the end date for each term.'
            )}
          </span>
        </div>
      </div>
      <hr className={styles.rule} />
      <fieldset className={styles.radios}>
        <legend>End date</legend>
        <div className={styles.choiceList}>
          <label className={cx(styles.choice, draft.endOption === 'full-year' && styles.choiceOn)}>
            <input
              type="radio"
              name="endOption"
              checked={draft.endOption === 'full-year'}
              onChange={() => pick('full-year')}
            />
            <span className={styles.choiceCopy}>
              <span className={styles.choiceTitle}>
                <span>Full year</span>
                <em>Ends {longDate(dates.fullYear)}</em>
              </span>
              <span className={styles.choiceDesc}>
                A 12-month fixed term, ending the day before the anniversary.
              </span>
            </span>
          </label>
          <label
            className={cx(styles.choice, draft.endOption === 'month-to-month' && styles.choiceOn)}
          >
            <input
              type="radio"
              name="endOption"
              checked={draft.endOption === 'month-to-month'}
              onChange={() => pick('month-to-month')}
            />
            <span className={styles.choiceCopy}>
              <span className={styles.choiceTitle}>
                <span>Month-to-month</span>
                <em>First period ends {longDate(dates.monthToMonth)}</em>
              </span>
              <span className={styles.choiceDesc}>
                The first period ends on the last day of the start month.
              </span>
            </span>
          </label>
          <div className={cx(styles.choice, draft.endOption === 'custom' && styles.choiceOn)}>
            <input
              type="radio"
              name="endOption"
              aria-label="Custom end date"
              checked={draft.endOption === 'custom'}
              onChange={() => pick('custom')}
            />
            <div className={styles.choiceCopy}>
              <span className={styles.choiceTitle}>
                <span>Custom end date</span>
                <em>Choose a date</em>
              </span>
              <span className={styles.choiceDesc}>
                Set a specific end date for a shorter or longer term.
              </span>
              <div className={styles.customDate}>
                <label className={styles.field} htmlFor="custom-end-date">
                  Custom end date
                  <input
                    id="custom-end-date"
                    className={styles.dateInput}
                    type="date"
                    aria-invalid={Boolean(errors.endDate)}
                    value={draft.customEndDate}
                    onChange={(e) => update({ endOption: 'custom', customEndDate: e.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
        <Err errors={errors} name="endDate" />
      </fieldset>
      <div className={styles.hintbar}>
        <span>
          Full-year and month-to-month end dates follow your start date. A custom end date stays as
          entered.
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 2. Rent

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthYear = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function ChargesPreview({ draft }: { draft: WizardDraft }) {
  const preview = useMemo(() => {
    const start = parseLeaseDate(draft.startDate);
    const end = parseLeaseDate(draft.endDate);
    if (!start || !end || end < start) return null;
    return previewScheduledCharges({
      startDate: start,
      endDate: end,
      fees: feesFromDraft(draft),
      asOf: new Date(),
    });
  }, [draft]);
  if (!preview || (!preview.moveIn.length && !preview.monthly.length))
    return (
      <div className={styles.ledger}>
        <div className={styles.ledgerHead}>
          <h3>Scheduled charges preview</h3>
        </div>
        <p className={styles.ledgerNote}>Enter the rent and lease dates to preview the charges.</p>
      </div>
    );
  const first = preview.monthly[0];
  const last = preview.monthly.at(-1);
  return (
    <div className={styles.ledger} data-testid="charges-preview">
      <div className={styles.ledgerHead}>
        <h3>Scheduled charges preview</h3>
        <span>Created in the Payments ledger</span>
      </div>
      {preview.moveIn.map((row) => (
        <div key={row.label} className={styles.ledgerRow}>
          <span>{shortDate(row.date)}</span>
          <span>{row.label}</span>
          <strong>{formatMoney(row.amountCents)}</strong>
        </div>
      ))}
      {preview.moveIn.length > 0 && (
        <div className={cx(styles.ledgerRow, styles.ledgerTotal)}>
          <span>Move-in</span>
          <span>Total scheduled at move-in</span>
          <strong>{formatMoney(preview.moveInTotalCents)}</strong>
        </div>
      )}
      {first && last && (
        <div className={styles.ledgerRow}>
          <span>{shortDate(first.date)}</span>
          <span>
            Monthly rent
            {preview.monthly.length > 1
              ? ` · repeats on the ${draft.rentDueDay}${[1, 21].includes(draft.rentDueDay) ? 'st' : [2, 22].includes(draft.rentDueDay) ? 'nd' : [3, 23].includes(draft.rentDueDay) ? 'rd' : 'th'} through ${monthYear(last.date)}`
              : ''}
          </span>
          <strong>{formatMoney(first.amountCents)}</strong>
        </div>
      )}
      <p className={styles.ledgerNote}>
        {preview.monthly.length} monthly rent charge{preview.monthly.length === 1 ? '' : 's'} are
        scheduled. Late fees are conditional and are not included until the rule applies.
      </p>
    </div>
  );
}

export function RentStep({ draft, update, errors }: StepProps) {
  const start = parseLeaseDate(draft.startDate);
  const end = parseLeaseDate(draft.endDate);
  const fees = feesFromDraft(draft);
  const proration =
    start && fees.monthlyRentCents > 0
      ? prorateFirstMonth(start, fees.monthlyRentCents, end ?? undefined, draft.rentDueDay)
      : null;
  const prorationText = proration
    ? `${shortDate(proration.from)}–${shortDate(proration.to)} · ${proration.days} of ${proration.daysInMonth} days · auto-calculated from monthly rent.`
    : start && fees.monthlyRentCents > 0
      ? 'The lease starts on the due day, so the first billing period is a full month.'
      : 'Enter the monthly rent and a start date to calculate this.';
  return (
    <div className={styles.fields}>
      <div className={styles.two}>
        <Field label="Monthly rent" error={errors.monthlyRent}>
          <input
            inputMode="decimal"
            value={draft.monthlyRent}
            placeholder="1850.00"
            onChange={(e) => update({ monthlyRent: e.target.value })}
          />
        </Field>
        <Field
          label="Rent due day"
          hint="Choose any day from the 1st through the 28th. The first rent period ends before the next due date."
          error={errors.rentDueDay}
        >
          <select
            value={draft.rentDueDay}
            onChange={(e) => update({ rentDueDay: Number(e.target.value) })}
          >
            {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
                {[1, 21].includes(day)
                  ? 'st'
                  : [2, 22].includes(day)
                    ? 'nd'
                    : [3, 23].includes(day)
                      ? 'rd'
                      : 'th'}{' '}
                of each month
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className={styles.two}>
        <Field label="Prorated first month" hint={prorationText}>
          <input
            readOnly
            value={proration ? formatMoney(proration.cents) : formatMoney(fees.monthlyRentCents)}
          />
        </Field>
        <Field
          label="Security deposit"
          hint="Scheduled as a one-time charge when the lease starts."
          error={errors.deposit}
        >
          <input
            inputMode="decimal"
            value={draft.deposit}
            placeholder="1850.00"
            onChange={(e) => update({ deposit: e.target.value })}
          />
        </Field>
      </div>
      {proration && (
        <label className={styles.radio}>
          <input
            type="checkbox"
            checked={draft.prorateFirstMonth}
            onChange={(e) => update({ prorateFirstMonth: e.target.checked })}
          />
          <span>
            Charge the prorated first period (otherwise the first full rent is due on the next due
            day)
          </span>
        </label>
      )}
      <hr className={styles.rule} />
      <h3 className={styles.sectionTitle}>Optional fees</h3>
      <div className={styles.two}>
        <Field label="Returned payment fee">
          <input
            inputMode="decimal"
            value={draft.returnedPaymentFee}
            onChange={(e) => update({ returnedPaymentFee: e.target.value })}
          />
        </Field>
        <Field label="Key replacement fee">
          <input
            inputMode="decimal"
            value={draft.keyFee}
            onChange={(e) => update({ keyFee: e.target.value })}
          />
        </Field>
      </div>
      <div className={styles.fees}>
        <label className={cx(styles.check, draft.moveInFeeEnabled && styles.checkOn)}>
          <input
            type="checkbox"
            checked={draft.moveInFeeEnabled}
            onChange={(e) => update({ moveInFeeEnabled: e.target.checked })}
          />
          <span className={styles.checkCopy}>
            <strong>Move-in fee</strong>
            <small>One-time charge due at move-in</small>
            {draft.moveInFeeEnabled && (
              <input
                aria-label="Move-in fee amount"
                inputMode="decimal"
                value={draft.moveInFee}
                placeholder="150.00"
                onChange={(e) => update({ moveInFee: e.target.value })}
              />
            )}
            <Err errors={errors} name="moveInFee" />
          </span>
        </label>
        <label className={cx(styles.check, draft.petDepositEnabled && styles.checkOn)}>
          <input
            type="checkbox"
            checked={draft.petDepositEnabled}
            onChange={(e) => update({ petDepositEnabled: e.target.checked })}
          />
          <span className={styles.checkCopy}>
            <strong>Pet deposit</strong>
            <small>One-time, refundable deposit</small>
            {draft.petDepositEnabled && (
              <input
                aria-label="Pet deposit amount"
                inputMode="decimal"
                value={draft.petDeposit}
                placeholder="250.00"
                onChange={(e) => update({ petDeposit: e.target.value })}
              />
            )}
            <Err errors={errors} name="petDeposit" />
          </span>
        </label>
        <label className={cx(styles.check, draft.lateFeeEnabled && styles.checkOn)}>
          <input
            type="checkbox"
            checked={draft.lateFeeEnabled}
            onChange={(e) => update({ lateFeeEnabled: e.target.checked })}
          />
          <span className={styles.checkCopy}>
            <strong>Late fee rules</strong>
            <small>Apply only if rent remains unpaid after the grace period.</small>
            {draft.lateFeeEnabled && (
              <span className={styles.two}>
                <input
                  aria-label="Late fee grace period (days)"
                  type="number"
                  min={0}
                  max={31}
                  value={draft.graceDays}
                  onChange={(e) => update({ graceDays: Number(e.target.value) })}
                />
                <input
                  aria-label="Late fee amount"
                  inputMode="decimal"
                  value={draft.lateFee}
                  onChange={(e) => update({ lateFee: e.target.value })}
                />
              </span>
            )}
            <Err errors={errors} name="lateFee" />
            <Err errors={errors} name="graceDays" />
          </span>
        </label>
      </div>
      <ChargesPreview draft={draft} />
    </div>
  );
}

// ------------------------------------------------------------------------------------ 3. Tenants

export function TenantsStep({
  draft,
  update,
  errors,
  tenants,
  sourceLabel,
  notice,
}: StepProps & { tenants: TenantOption[]; sourceLabel?: string; notice?: string }) {
  const toggle = (id: string, checked: boolean) => {
    const tenantIds = checked ? [...draft.tenantIds, id] : draft.tenantIds.filter((t) => t !== id);
    update({
      tenantIds,
      primaryTenantId:
        draft.primaryTenantId && tenantIds.includes(draft.primaryTenantId)
          ? draft.primaryTenantId
          : (tenantIds[0] ?? ''),
    });
  };
  return (
    <div className={styles.fields}>
      {sourceLabel && (
        <p className={styles.sub}>
          Renewal for {sourceLabel}. Tenants carry over from the current lease.
        </p>
      )}
      {notice && <p className={styles.sub}>{notice}</p>}
      <div className={styles.checks} role="group" aria-label="Tenants">
        {tenants.map((t) => {
          const on = draft.tenantIds.includes(t.id);
          return (
            <label key={t.id} className={cx(styles.check, on && styles.checkOn)}>
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => toggle(t.id, e.target.checked)}
              />
              <span className={styles.checkCopy}>
                <strong>{t.name}</strong>
                <small>{t.email ?? 'No email on file'}</small>
              </span>
            </label>
          );
        })}
        {!tenants.length && <p className={styles.sub}>No tenants yet. Add a tenant first.</p>}
      </div>
      <Err errors={errors} name="tenantIds" />
      <Field label="Primary tenant" error={errors.primaryTenantId}>
        <select
          value={draft.primaryTenantId}
          onChange={(e) => update({ primaryTenantId: e.target.value })}
        >
          <option value="">Select a primary tenant</option>
          {tenants
            .filter((t) => draft.tenantIds.includes(t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </Field>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 4–7 lists

export function OptionsStep({ draft, update, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <div className={styles.two}>
        <Field label="Renewal notice period" error={errors.renewalNoticeDays}>
          <select
            value={draft.renewalNoticeDays}
            onChange={(e) => update({ renewalNoticeDays: Number(e.target.value) })}
          >
            <option value={30}>30 days before end date</option>
            <option value={60}>60 days before end date</option>
            <option value={90}>90 days before end date</option>
          </select>
        </Field>
        <Field
          label="Occupants (optional)"
          error={errors.occupants}
          hint="Names of everyone who will live in the unit."
        >
          <input value={draft.occupants} onChange={(e) => update({ occupants: e.target.value })} />
        </Field>
      </div>
      <CheckList
        name="Lease options"
        options={OPTION_CHOICES}
        selected={draft.options}
        onChange={(options) => update({ options })}
      />
      <Err errors={errors} name="options" />
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={draft.assignedParking}
          onChange={(e) => update({ assignedParking: e.target.checked })}
        />
        <span className={styles.checkCopy}>
          <strong>Assigned parking</strong>
          <small>Add the parking rule when this lease includes a space.</small>
        </span>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={draft.balconyPatio}
          onChange={(e) => update({ balconyPatio: e.target.checked })}
        />
        <span className={styles.checkCopy}>
          <strong>Balcony or patio</strong>
          <small>Include the outdoor space rule.</small>
        </span>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={draft.sharedLaundry}
          onChange={(e) => update({ sharedLaundry: e.target.checked })}
        />
        <span className={styles.checkCopy}>
          <strong>Shared laundry</strong>
          <small>Include the laundry rule.</small>
        </span>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={draft.floodZone}
          onChange={(e) => update({ floodZone: e.target.checked })}
        />
        <span className={styles.checkCopy}>
          <strong>Flood zone</strong>
          <small>Include the flood disclosure.</small>
        </span>
      </label>
      <fieldset className={styles.radios}>
        <legend>Utilities paid by tenant</legend>
        {['Electricity', 'Gas', 'Water', 'Trash', 'Internet'].map((utility) => (
          <label key={utility} className={styles.radio}>
            <input
              type="checkbox"
              checked={draft.tenantUtilities.includes(utility)}
              onChange={(e) =>
                update({
                  tenantUtilities: e.target.checked
                    ? [...draft.tenantUtilities, utility]
                    : draft.tenantUtilities.filter((u) => u !== utility),
                })
              }
            />
            {utility}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function ClausesStep({ draft, update, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <CheckList
        name="Included lease terms"
        options={CLAUSE_OPTIONS}
        selected={draft.clauses}
        onChange={(clauses) => update({ clauses })}
      />
      <Err errors={errors} name="clauses" />
      <Field label="Custom clause (optional)" error={errors.customClause}>
        <textarea
          value={draft.customClause}
          maxLength={600}
          onChange={(e) => update({ customClause: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function RulesStep({ draft, update, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <CheckList
        name="House rules"
        options={RULE_OPTIONS}
        selected={draft.rules}
        onChange={(rules) => update({ rules })}
      />
      <Err errors={errors} name="rules" />
      <Field label="Additional rules (optional)" error={errors.customRules}>
        <textarea
          value={draft.customRules}
          maxLength={1100}
          onChange={(e) => update({ customRules: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function DisclosuresStep({ draft, update, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <CheckList
        name="Disclosures"
        options={DISCLOSURE_OPTIONS}
        selected={draft.disclosures}
        onChange={(disclosures) => update({ disclosures })}
      />
      <Err errors={errors} name="disclosures" />
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
  if (!leaseId)
    return <p className={styles.sub}>Save the lease term first, then add documents here.</p>;
  return (
    <div className={styles.fields}>
      <h3 className={styles.sectionTitle}>Documents to include</h3>
      {files.length === 0 && (
        <p className={styles.sub}>
          No documents added yet. Include any lease agreement, addenda or disclosure files the
          tenant should review.
        </p>
      )}
      {typeError && (
        <p className={styles.alert} role="alert">
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
      <p className={styles.caption}>
        Each file is stored as a lease document with the type selected above. Review required
        disclosures before sending.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 9. Lessor

export function LessorStep({ draft, update, errors }: StepProps) {
  return (
    <div className={styles.fields}>
      <div className={styles.two}>
        <Field label="Lessor name" error={errors.lessorName}>
          <input
            value={draft.lessorName}
            onChange={(e) => update({ lessorName: e.target.value })}
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            value={draft.lessorPhone}
            onChange={(e) => update({ lessorPhone: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Mailing address" error={errors.lessorAddress}>
        <input
          value={draft.lessorAddress}
          onChange={(e) => update({ lessorAddress: e.target.value })}
        />
      </Field>
      <Field label="Email (optional)" error={errors.lessorEmail}>
        <input
          type="email"
          value={draft.lessorEmail}
          onChange={(e) => update({ lessorEmail: e.target.value })}
        />
      </Field>
    </div>
  );
}

// ------------------------------------------------------------------------------------ 10. Review

const money = (value: string) => {
  const n = Number(value.replace(/[$,]/g, ''));
  return value && Number.isFinite(n) ? formatMoney(Math.round(n * 100)) : '—';
};

export function ReviewStep({
  draft,
  errors,
  unitLabel,
  tenants,
  attachments,
}: {
  draft: WizardDraft;
  errors: WizardErrors;
  unitLabel: string;
  tenants: TenantOption[];
  attachments: AttachmentFile[];
}) {
  const names = tenants.filter((t) => draft.tenantIds.includes(t.id)).map((t) => t.name);
  const primary = tenants.find((t) => t.id === draft.primaryTenantId);
  const list = (items: string[]) => (items.length ? items.join('; ') : 'None');
  return (
    <div>
      <h3 className={styles.reviewSection}>Lease</h3>
      <dl className={styles.review}>
        <dt>Unit</dt>
        <dd>{unitLabel}</dd>
        <dt>Tenants</dt>
        <dd>{names.join(', ') || 'Not selected'}</dd>
        <dt>Term</dt>
        <dd>
          {termLabel(draft)}
          {draft.endOption === 'month-to-month' ? ' · month to month' : ''}
        </dd>
        <dt>Renewal notice</dt>
        <dd>{draft.renewalNoticeDays} days</dd>
      </dl>
      <h3 className={styles.reviewSection}>Rent, deposit &amp; fees</h3>
      <dl className={styles.review}>
        <dt>Monthly rent</dt>
        <dd>
          {money(draft.monthlyRent)}, due on the {draft.rentDueDay}
          {[1, 21].includes(draft.rentDueDay)
            ? 'st'
            : [2, 22].includes(draft.rentDueDay)
              ? 'nd'
              : [3, 23].includes(draft.rentDueDay)
                ? 'rd'
                : 'th'}
        </dd>
        <dt>Security deposit</dt>
        <dd>{money(draft.deposit)}</dd>
        {draft.moveInFeeEnabled && (
          <>
            <dt>Move-in fee</dt>
            <dd>{money(draft.moveInFee)}</dd>
          </>
        )}
        {draft.petDepositEnabled && (
          <>
            <dt>Pet deposit</dt>
            <dd>{money(draft.petDeposit)}</dd>
          </>
        )}
        <dt>Late fee</dt>
        <dd>
          {draft.lateFeeEnabled
            ? `${money(draft.lateFee)} after a ${draft.graceDays}-day grace period`
            : 'None'}
        </dd>
        <dt>Due at signing</dt>
        <dd>{formatMoney(Math.round(dueAtSigning(draft) * 100))}</dd>
      </dl>
      <ChargesPreview draft={draft} />
      <h3 className={styles.reviewSection}>Terms</h3>
      <dl className={styles.review}>
        <dt>Options</dt>
        <dd>{list(optionLabels(draft.options))}</dd>
        <dt>Clauses</dt>
        <dd>
          {draft.template
            ? list(
                resolveTerms(draft.template, contextFromDraft(draft), draft.termOverrides)
                  .filter((t) => t.included && t.section === 'CLAUSE')
                  .map((t) => t.title),
              )
            : list(clauseLabels(draft.clauses))}
        </dd>
        <dt>Rules</dt>
        <dd>
          {draft.template
            ? list(
                resolveTerms(draft.template, contextFromDraft(draft), draft.termOverrides)
                  .filter((t) => t.included && t.section === 'RULE')
                  .map((t) => t.title),
              )
            : list(ruleLabels(draft.rules))}
        </dd>
        <dt>Disclosures</dt>
        <dd>
          {draft.template
            ? list(
                resolveTerms(draft.template, contextFromDraft(draft), draft.termOverrides)
                  .filter((t) => t.included && t.section === 'DISCLOSURE')
                  .map((t) => t.title),
              )
            : list(disclosureLabels(draft.disclosures))}
        </dd>
        <dt>Attachments</dt>
        <dd>{attachments.length ? attachments.map((a) => a.name).join(', ') : 'None'}</dd>
      </dl>
      <h3 className={styles.reviewSection}>Lessor and signature</h3>
      <dl className={styles.review}>
        <dt>Lessor</dt>
        <dd>
          {draft.lessorName || '—'}
          {draft.lessorAddress ? ` · ${draft.lessorAddress}` : ''}
        </dd>
        <dt>Signature</dt>
        <dd>Electronic · mock provider · {primary?.name ?? 'Primary tenant'}</dd>
      </dl>
      {Object.keys(errors).length > 0 && (
        <div className={styles.alert} role="alert" style={{ marginTop: 16 }}>
          {Object.values(errors).join(' ')}
        </div>
      )}
      <p className={styles.sub} style={{ marginTop: 16 }}>
        Sending creates an active lease, adds its move-in charges to Payments and emails the signer
        through the mock provider (no real email is sent).
      </p>
    </div>
  );
}
