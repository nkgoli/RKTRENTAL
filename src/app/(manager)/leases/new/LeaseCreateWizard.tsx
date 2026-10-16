'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileUploader } from '@/components/upload';
import { Alert, Badge, Button, Card, CardHeader, Steps } from '@/components/ui';
import { CLAUSE_OPTIONS, STANDARD_DOCUMENTS } from '@/lib/lease-create/clauses';
import { WIZARD_STEPS, type WizardDraft } from '@/lib/lease-create/types';
import {
  dueAtSigning,
  suggestedEndDate,
  termLabel,
  validateStep,
} from '@/lib/lease-create/validation';
import { completeSigningAction, submitWizardAction, type WizardActionState } from './actions';

const initial: WizardActionState = {};
const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

type Props = {
  units: { id: string; label: string; status: string; listedRent: string | null }[];
  tenants: { id: string; name: string; email: string | null }[];
  renewId?: string;
  initialDraft: WizardDraft;
  sourceLabel?: string;
  renewalSourceEnd?: string | null;
};

export function LeaseCreateWizard({ units, tenants, renewId, initialDraft, sourceLabel }: Props) {
  const [draft, setDraft] = useState<WizardDraft>(initialDraft);
  const [step, setStep] = useState(0);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState(submitWizardAction, initial);
  const [signState, signAction, signing] = useActionState(completeSigningAction, initial);
  const errors = { ...localErrors, ...(state.errors ?? {}) };
  const leaseId = signState.leaseId ?? state.leaseId;
  const esignStatus = signState.esignStatus ?? state.esignStatus;

  const set = (patch: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const summaryTenant = useMemo(
    () =>
      tenants.find((t) => t.id === draft.primaryTenantId) ??
      tenants.find((t) => draft.tenantIds.includes(t.id)),
    [tenants, draft.primaryTenantId, draft.tenantIds],
  );
  const summaryUnit = units.find((u) => u.id === draft.unitId);

  function goNext() {
    const errs = validateStep(step, draft, { tenants, isRenewal: Boolean(renewId) });
    setLocalErrors(errs);
    if (!Object.keys(errs).length) setStep((s) => Math.min(4, s + 1));
  }
  function toggleTenant(id: string, checked: boolean) {
    const tenantIds = checked ? [...draft.tenantIds, id] : draft.tenantIds.filter((t) => t !== id);
    set({
      tenantIds,
      primaryTenantId:
        draft.primaryTenantId && tenantIds.includes(draft.primaryTenantId)
          ? draft.primaryTenantId
          : (tenantIds[0] ?? ''),
    });
  }
  const err = (k: string) => (errors[k] ? <small role="alert">{errors[k]}</small> : null);

  return (
    <div className="split" style={{ alignItems: 'start' }}>
      <div className="stack">
        <Steps steps={[...WIZARD_STEPS]} current={step} />
        {(state.message || signState.message) && (
          <Alert tone={signState.ok || state.ok ? 'success' : 'warning'}>
            {signState.message ?? state.message}
          </Alert>
        )}
        {leaseId && (
          <Card>
            <CardHeader
              title="Lease created"
              action={
                <Badge tone={esignStatus === 'SIGNED' ? 'success' : 'info'}>
                  {esignStatus ?? 'NOT_SENT'}
                </Badge>
              }
            />
            <p className="muted" style={{ marginBottom: 12 }}>
              {esignStatus === 'SIGNED'
                ? 'The signed lease PDF is stored on the lease as “Signed lease agreement.pdf”.'
                : 'The lease is saved. Finish mock signing here, or open the lease detail to review it.'}
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Link className="btn btn-primary btn-sm" href={`/leases/${leaseId}`}>
                View lease detail
              </Link>
              {esignStatus === 'SENT' && (
                <form action={signAction}>
                  <input type="hidden" name="leaseId" value={leaseId} />
                  <Button type="submit" variant="secondary" size="sm" disabled={signing}>
                    {signing ? 'Signing…' : 'Complete mock signing'}
                  </Button>
                </form>
              )}
              {esignStatus === 'SIGNED' && (
                <Badge tone="success">Signed lease agreement.pdf stored</Badge>
              )}
            </div>
          </Card>
        )}
        <form className="form" action={action} noValidate>
          {renewId && <input type="hidden" name="renewId" value={renewId} />}
          <input type="hidden" name="unitId" value={draft.unitId} />
          {draft.tenantIds.map((id) => (
            <input key={id} type="hidden" name="tenantIds" value={id} />
          ))}
          <input type="hidden" name="primaryTenantId" value={draft.primaryTenantId} />
          <input type="hidden" name="leaseType" value={draft.leaseType} />
          <input type="hidden" name="startDate" value={draft.startDate} />
          <input type="hidden" name="endDate" value={draft.endDate} />
          <input type="hidden" name="renewalNoticeDays" value={draft.renewalNoticeDays} />
          <input type="hidden" name="monthlyRent" value={draft.monthlyRent} />
          <input type="hidden" name="deposit" value={draft.deposit} />
          <input type="hidden" name="lateFee" value={draft.lateFee} />
          <input type="hidden" name="graceDays" value={draft.graceDays} />
          <input type="hidden" name="rentDueDay" value={draft.rentDueDay} />
          {draft.clauses.map((id) => (
            <input key={id} type="hidden" name="clauses" value={id} />
          ))}
          <input type="hidden" name="customClause" value={draft.customClause} />
          {draft.documentNames.map((n) => (
            <input key={n} type="hidden" name="documentNames" value={n} />
          ))}

          {step === 0 && (
            <Card>
              <CardHeader title="Unit and tenants" />
              {sourceLabel && (
                <p className="muted" style={{ marginBottom: 14 }}>
                  Renewal for {sourceLabel}. The unit and tenants carry over from the current lease.
                </p>
              )}
              <div className="form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label className="field">
                  Property / unit
                  <select
                    aria-label="Property / unit"
                    value={draft.unitId}
                    disabled={Boolean(renewId)}
                    onChange={(e) => {
                      const unit = units.find((u) => u.id === e.target.value);
                      set({
                        unitId: e.target.value,
                        monthlyRent: draft.monthlyRent || unit?.listedRent || '',
                      });
                    }}
                  >
                    <option value="">Select a unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                        {u.status === 'VACANT' ? ' · Vacant' : ''}
                      </option>
                    ))}
                  </select>
                  {err('unitId')}
                </label>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                    Tenants
                  </legend>
                  <div className="stack" style={{ gap: 8 }}>
                    {tenants.map((t) => (
                      <label key={t.id} className="check">
                        <input
                          type="checkbox"
                          checked={draft.tenantIds.includes(t.id)}
                          onChange={(e) => toggleTenant(t.id, e.target.checked)}
                        />
                        {t.name}
                        {t.email ? ` · ${t.email}` : ' · No email'}
                      </label>
                    ))}
                  </div>
                  {err('tenantIds')}
                </fieldset>
                <label className="field">
                  Primary tenant
                  <select
                    aria-label="Primary tenant"
                    value={draft.primaryTenantId}
                    onChange={(e) => set({ primaryTenantId: e.target.value })}
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
                  {err('primaryTenantId')}
                </label>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader title="Lease terms" />
              <p className="muted" style={{ marginBottom: 14 }}>
                Set the terms for this lease. Renewal dates follow the existing lease: the new term
                begins the day after the current agreement ends.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-row">
                  <label className="field">
                    Lease type
                    <select
                      aria-label="Lease type"
                      value={draft.leaseType}
                      onChange={(e) => {
                        const leaseType = e.target.value as WizardDraft['leaseType'];
                        const start = draft.startDate
                          ? new Date(`${draft.startDate}T00:00:00.000Z`)
                          : null;
                        set({
                          leaseType,
                          endDate:
                            start && !Number.isNaN(start.getTime())
                              ? suggestedEndDate(start, leaseType).toISOString().slice(0, 10)
                              : draft.endDate,
                        });
                      }}
                    >
                      <option value="fixed">Fixed term · 12 months</option>
                      <option value="month-to-month">Month to month</option>
                    </select>
                  </label>
                  <label className="field">
                    Start date
                    <input
                      aria-label="Start date"
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => set({ startDate: e.target.value })}
                    />
                    {err('startDate')}
                  </label>
                </div>
                <div className="form-row">
                  <label className="field">
                    End date
                    <input
                      aria-label="End date"
                      type="date"
                      value={draft.endDate}
                      onChange={(e) => set({ endDate: e.target.value })}
                    />
                    {err('endDate')}
                  </label>
                  <label className="field">
                    Renewal notice period
                    <select
                      aria-label="Renewal notice period"
                      value={draft.renewalNoticeDays}
                      onChange={(e) => set({ renewalNoticeDays: Number(e.target.value) })}
                    >
                      <option value={30}>30 days before end date</option>
                      <option value={60}>60 days before end date</option>
                      <option value={90}>90 days before end date</option>
                    </select>
                    {err('renewalNoticeDays')}
                  </label>
                </div>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader title="Rent and deposit" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-row">
                  <label className="field">
                    Monthly rent
                    <input
                      aria-label="Monthly rent"
                      inputMode="decimal"
                      value={draft.monthlyRent}
                      onChange={(e) => set({ monthlyRent: e.target.value })}
                    />
                    {err('monthlyRent')}
                  </label>
                  <label className="field">
                    Security deposit
                    <input
                      aria-label="Security deposit"
                      inputMode="decimal"
                      value={draft.deposit}
                      onChange={(e) => set({ deposit: e.target.value })}
                    />
                    {err('deposit')}
                  </label>
                </div>
                <div className="form-row">
                  <label className="field">
                    Late fee
                    <input
                      aria-label="Late fee"
                      inputMode="decimal"
                      value={draft.lateFee}
                      onChange={(e) => set({ lateFee: e.target.value })}
                    />
                    {err('lateFee')}
                  </label>
                  <label className="field">
                    Grace period (days)
                    <input
                      aria-label="Grace period (days)"
                      type="number"
                      min={0}
                      max={31}
                      value={draft.graceDays}
                      onChange={(e) => set({ graceDays: Number(e.target.value) })}
                    />
                    {err('graceDays')}
                  </label>
                </div>
                <label className="field">
                  Rent due day
                  <input
                    aria-label="Rent due day"
                    type="number"
                    min={1}
                    max={28}
                    value={draft.rentDueDay}
                    onChange={(e) => set({ rentDueDay: Number(e.target.value) })}
                  />
                  <span className="hint">Rent is due on this day each month.</span>
                  {err('rentDueDay')}
                </label>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader title="Clauses and documents" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h4 style={{ marginBottom: 10 }}>Included lease terms</h4>
                  {CLAUSE_OPTIONS.map((c) => (
                    <label key={c.id} className="check" style={{ marginBottom: 10 }}>
                      <input
                        type="checkbox"
                        checked={draft.clauses.includes(c.id)}
                        onChange={(e) =>
                          set({
                            clauses: e.target.checked
                              ? [...draft.clauses, c.id]
                              : draft.clauses.filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                  {err('clauses')}
                </div>
                <label className="field">
                  Custom clause (optional)
                  <textarea
                    aria-label="Custom clause"
                    value={draft.customClause}
                    maxLength={600}
                    onChange={(e) => set({ customClause: e.target.value })}
                  />
                  {err('customClause')}
                </label>
                <div>
                  <h4 style={{ marginBottom: 8 }}>Lease clauses and documents</h4>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                    {STANDARD_DOCUMENTS.join(' · ')} — the signed lease PDF is stored on the lease
                    automatically after mock signing.
                  </p>
                  <div className="field">
                    <span>Attach documents (optional)</span>
                    <FileUploader
                      kind="document"
                      formField="documents"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      label="Attach documents"
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader title="Review and send" />
              <dl className="kv">
                <dt>Unit</dt>
                <dd>{summaryUnit?.label ?? 'Not selected'}</dd>
                <dt>Tenants</dt>
                <dd>
                  {tenants
                    .filter((t) => draft.tenantIds.includes(t.id))
                    .map((t) => t.name)
                    .join(', ') || 'Not selected'}
                </dd>
                <dt>Term</dt>
                <dd>{termLabel(draft)}</dd>
                <dt>Monthly rent</dt>
                <dd>{draft.monthlyRent ? moneyFmt.format(Number(draft.monthlyRent)) : '—'}</dd>
                <dt>Security deposit</dt>
                <dd>{draft.deposit ? moneyFmt.format(Number(draft.deposit)) : '—'}</dd>
                <dt>Due at signing</dt>
                <dd>{moneyFmt.format(dueAtSigning(draft))}</dd>
                <dt>Clauses</dt>
                <dd>
                  {CLAUSE_OPTIONS.filter((c) => draft.clauses.includes(c.id))
                    .map((c) => c.label)
                    .join('; ') || 'None'}
                </dd>
                <dt>Signature</dt>
                <dd>Electronic · mock provider · {summaryTenant?.name ?? 'Primary tenant'}</dd>
              </dl>
              <p className="muted" style={{ marginTop: 14 }}>
                You will review all terms before sending the lease for e-signature. Sending creates
                an active lease and emails the signer through the mock provider (no real email is
                sent).
              </p>
            </Card>
          )}

          <div className="row between" style={{ flexWrap: 'wrap' }}>
            <Button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              ← Back
            </Button>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Button type="submit" name="intent" value="draft" disabled={pending}>
                {pending ? 'Saving…' : 'Save draft'}
              </Button>
              {step < 4 ? (
                <Button key="continue" type="button" variant="primary" onClick={goNext}>
                  Continue
                </Button>
              ) : (
                <Button
                  key="send"
                  type="submit"
                  variant="primary"
                  name="intent"
                  value="send"
                  disabled={pending}
                >
                  {pending ? 'Sending…' : 'Send for e-signature'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      <aside>
        <Card>
          <CardHeader title="Lease summary" action={<Badge tone="warning">Needs review</Badge>} />
          <dl className="kv">
            <dt>Tenant</dt>
            <dd>{summaryTenant?.name ?? 'Not selected'}</dd>
            <dt>Unit</dt>
            <dd>{summaryUnit?.label ?? 'Not selected'}</dd>
            <dt>Term</dt>
            <dd>{termLabel(draft)}</dd>
            <dt>Monthly rent</dt>
            <dd>{draft.monthlyRent ? moneyFmt.format(Number(draft.monthlyRent)) : '—'}</dd>
            <dt>Security deposit</dt>
            <dd>{draft.deposit ? moneyFmt.format(Number(draft.deposit)) : '—'}</dd>
            <dt>Rent due</dt>
            <dd>{draft.rentDueDay}st of each month</dd>
            <dt>Signature</dt>
            <dd>Electronic · 1 signer</dd>
          </dl>
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            Each lease covers one unit. An active lease cannot overlap another active lease for the
            same unit.
          </p>
        </Card>
      </aside>
    </div>
  );
}
