'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { saveLeaseAction, type LeaseFormState } from './actions';
import {
  activateDetailLeaseAction,
  editDetailTermsAction,
  recordDetailNoticeAction,
  terminateDetailLeaseAction,
} from './[id]/actions';
import { leaseResultMessages, type LeaseReturnScope } from './[id]/feedback';

const initial: LeaseFormState = {};

function FormFeedback({ state }: { state: LeaseFormState }) {
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message && !state.ok) feedback.current?.focus();
  }, [state]);
  return state.message ? (
    <div ref={feedback} tabIndex={-1}>
      <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
    </div>
  ) : null;
}

export type TermValues = {
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  lateFee: string;
  graceDays: number;
};

export function TermFields({
  values,
  errors = {},
}: {
  values: TermValues;
  errors?: Record<string, string>;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState(values);
  const valuesKey = JSON.stringify(values);
  useEffect(() => setDraft(JSON.parse(valuesKey)), [valuesKey]);
  return (
    <>
      <div className="form-row">
        <label className="field">
          Start date
          <input
            name="startDate"
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
            required
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? fieldId + '-startDate-error' : undefined}
          />
          {errors.startDate && (
            <small id={fieldId + '-startDate-error'} role="alert">
              {errors.startDate}
            </small>
          )}
        </label>
        <label className="field">
          End date
          <input
            name="endDate"
            type="date"
            value={draft.endDate}
            onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
            required
            aria-invalid={!!errors.endDate}
            aria-describedby={errors.endDate ? fieldId + '-endDate-error' : undefined}
          />
          {errors.endDate && (
            <small id={fieldId + '-endDate-error'} role="alert">
              {errors.endDate}
            </small>
          )}
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          Monthly rent
          <input
            name="monthlyRent"
            inputMode="decimal"
            value={draft.monthlyRent}
            onChange={(event) => setDraft({ ...draft, monthlyRent: event.target.value })}
            required
            aria-invalid={!!errors.monthlyRent}
            aria-describedby={errors.monthlyRent ? fieldId + '-monthlyRent-error' : undefined}
          />
          {errors.monthlyRent && (
            <small id={fieldId + '-monthlyRent-error'} role="alert">
              {errors.monthlyRent}
            </small>
          )}
        </label>
        <label className="field">
          Security deposit
          <input
            name="deposit"
            inputMode="decimal"
            value={draft.deposit}
            onChange={(event) => setDraft({ ...draft, deposit: event.target.value })}
            required
            aria-invalid={!!errors.deposit}
            aria-describedby={errors.deposit ? fieldId + '-deposit-error' : undefined}
          />
          {errors.deposit && (
            <small id={fieldId + '-deposit-error'} role="alert">
              {errors.deposit}
            </small>
          )}
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          Late fee
          <input
            name="lateFee"
            inputMode="decimal"
            value={draft.lateFee}
            onChange={(event) => setDraft({ ...draft, lateFee: event.target.value })}
            aria-invalid={!!errors.lateFee}
            aria-describedby={errors.lateFee ? fieldId + '-lateFee-error' : undefined}
          />
          {errors.lateFee && (
            <small id={fieldId + '-lateFee-error'} role="alert">
              {errors.lateFee}
            </small>
          )}
        </label>
        <label className="field">
          Grace period (days)
          <input
            name="graceDays"
            type="number"
            min="0"
            max="31"
            value={draft.graceDays}
            onChange={(event) => setDraft({ ...draft, graceDays: Number(event.target.value) })}
            aria-invalid={!!errors.graceDays}
            aria-describedby={errors.graceDays ? fieldId + '-graceDays-error' : undefined}
          />
          {errors.graceDays && (
            <small id={fieldId + '-graceDays-error'} role="alert">
              {errors.graceDays}
            </small>
          )}
        </label>
      </div>
    </>
  );
}

export function NewLeaseForm({
  units,
  tenants,
  renewId,
  values,
}: {
  units: { id: string; label: string }[];
  tenants: { id: string; name: string }[];
  renewId?: string;
  values: TermValues;
}) {
  const [state, action, pending] = useActionState(saveLeaseAction, initial);
  return (
    <form className="form" action={action} noValidate>
      {renewId && <input type="hidden" name="renewId" value={renewId} />}
      {state.message && <Alert tone="warning">{state.message}</Alert>}
      {!renewId && (
        <>
          <div className="form-row">
            <label className="field">
              Property / unit
              <select name="unitId" required aria-invalid={!!state.errors?.unitId}>
                <option value="">Select a unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
              {state.errors?.unitId && <small role="alert">{state.errors.unitId}</small>}
            </label>
            <label className="field">
              Tenant
              <select name="tenantId" required aria-invalid={!!state.errors?.tenantId}>
                <option value="">Select a tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {state.errors?.tenantId && <small role="alert">{state.errors.tenantId}</small>}
            </label>
          </div>
        </>
      )}
      <TermFields values={values} errors={state.errors} />
      {!renewId && (
        <label className="field">
          Lease status
          <select name="status" defaultValue="DRAFT">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
      )}
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : renewId ? 'Create renewal draft' : 'Create lease'}
      </Button>
    </form>
  );
}

export function EditTermsForm({
  leaseId,
  values,
  returnScope,
  saved = false,
}: {
  leaseId: string;
  values: TermValues;
  returnScope?: LeaseReturnScope;
  saved?: boolean;
}) {
  const [state, action, pending] = useActionState(
    editDetailTermsAction,
    saved ? { ok: true, message: leaseResultMessages.terms } : initial,
  );
  return (
    <form className="form" action={action} noValidate id="edit-terms" aria-label="Edit lease terms">
      <input type="hidden" name="leaseId" value={leaseId} />
      <input type="hidden" name="returnScope" value={returnScope ?? ''} />
      <FormFeedback state={state} />
      <TermFields values={values} errors={state.errors} />
      <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save terms'}
      </Button>
    </form>
  );
}

export function LeaseStatusActions({
  leaseId,
  status,
  returnScope,
}: {
  leaseId: string;
  status: string;
  returnScope?: LeaseReturnScope;
}) {
  const [activeState, activate, activating] = useActionState(activateDetailLeaseAction, initial);
  const [endState, terminate, terminating] = useActionState(terminateDetailLeaseAction, initial);
  const [confirming, setConfirming] = useState(false);
  const confirmation = useRef<HTMLFormElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) confirmation.current?.focus();
    else if (wasConfirming.current) trigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {status === 'DRAFT' && (
        <form action={activate}>
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="returnScope" value={returnScope ?? ''} />
          <Button type="submit" variant="primary" disabled={activating} aria-busy={activating}>
            {activating ? 'Activating…' : 'Activate lease'}
          </Button>
        </form>
      )}
      {status === 'ACTIVE' &&
        (confirming ? (
          <form
            ref={confirmation}
            action={terminate}
            className="row"
            tabIndex={-1}
            aria-label="Confirm lease termination"
          >
            <input type="hidden" name="leaseId" value={leaseId} />
            <input type="hidden" name="returnScope" value={returnScope ?? ''} />
            <span>Terminate this lease?</span>
            <Button type="submit" variant="danger" disabled={terminating} aria-busy={terminating}>
              {terminating ? 'Terminating…' : 'Confirm terminate'}
            </Button>
            <Button type="button" disabled={terminating} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <button
            ref={trigger}
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirming(true)}
          >
            Terminate
          </button>
        ))}
      {activeState.message && (
        <Alert tone={activeState.ok ? 'success' : 'error'}>{activeState.message}</Alert>
      )}
      {endState.message && (
        <Alert tone={endState.ok ? 'success' : 'error'}>{endState.message}</Alert>
      )}
    </div>
  );
}

export function NoticeForm({
  leaseId,
  noticeGivenAt,
  moveOutDate,
  returnScope,
  saved = false,
}: {
  leaseId: string;
  noticeGivenAt: string;
  moveOutDate: string;
  returnScope?: LeaseReturnScope;
  saved?: boolean;
}) {
  const [state, action, pending] = useActionState(
    recordDetailNoticeAction,
    saved ? { ok: true, message: leaseResultMessages.notice } : initial,
  );
  const fieldId = useId();
  const [dates, setDates] = useState({ noticeGivenAt, moveOutDate });
  useEffect(() => setDates({ noticeGivenAt, moveOutDate }), [noticeGivenAt, moveOutDate]);
  return (
    <form
      className="form"
      action={action}
      noValidate
      id="lease-notice"
      aria-label="Notice and move-out"
    >
      <input type="hidden" name="leaseId" value={leaseId} />
      <input type="hidden" name="returnScope" value={returnScope ?? ''} />
      <FormFeedback state={state} />
      <div className="form-row">
        <label className="field">
          Notice given
          <input
            name="noticeGivenAt"
            type="date"
            value={dates.noticeGivenAt}
            onChange={(event) => setDates({ ...dates, noticeGivenAt: event.target.value })}
            required
            aria-invalid={!!state.errors?.noticeGivenAt}
            aria-describedby={state.errors?.noticeGivenAt ? fieldId + '-notice-error' : undefined}
          />
          {state.errors?.noticeGivenAt && (
            <small id={fieldId + '-notice-error'} role="alert">
              {state.errors.noticeGivenAt}
            </small>
          )}
        </label>
        <label className="field">
          Planned move-out
          <input
            name="moveOutDate"
            type="date"
            value={dates.moveOutDate}
            onChange={(event) => setDates({ ...dates, moveOutDate: event.target.value })}
            aria-invalid={!!state.errors?.moveOutDate}
            aria-describedby={state.errors?.moveOutDate ? fieldId + '-moveout-error' : undefined}
          />
          {state.errors?.moveOutDate && (
            <small id={fieldId + '-moveout-error'} role="alert">
              {state.errors.moveOutDate}
            </small>
          )}
        </label>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Record notice'}
      </Button>
    </form>
  );
}
