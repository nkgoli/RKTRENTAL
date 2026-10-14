'use client';

import { useActionState, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import {
  activateLeaseAction,
  editTermsAction,
  recordNoticeAction,
  saveLeaseAction,
  terminateLeaseAction,
  type LeaseFormState,
} from './actions';

const initial: LeaseFormState = {};

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
  return (
    <>
      <div className="form-row">
        <label className="field">
          Start date
          <input
            name="startDate"
            type="date"
            defaultValue={values.startDate}
            required
            aria-invalid={!!errors.startDate}
          />
          {errors.startDate && <small role="alert">{errors.startDate}</small>}
        </label>
        <label className="field">
          End date
          <input
            name="endDate"
            type="date"
            defaultValue={values.endDate}
            required
            aria-invalid={!!errors.endDate}
          />
          {errors.endDate && <small role="alert">{errors.endDate}</small>}
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          Monthly rent
          <input
            name="monthlyRent"
            inputMode="decimal"
            defaultValue={values.monthlyRent}
            required
            aria-invalid={!!errors.monthlyRent}
          />
          {errors.monthlyRent && <small role="alert">{errors.monthlyRent}</small>}
        </label>
        <label className="field">
          Security deposit
          <input
            name="deposit"
            inputMode="decimal"
            defaultValue={values.deposit}
            required
            aria-invalid={!!errors.deposit}
          />
          {errors.deposit && <small role="alert">{errors.deposit}</small>}
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          Late fee
          <input
            name="lateFee"
            inputMode="decimal"
            defaultValue={values.lateFee}
            aria-invalid={!!errors.lateFee}
          />
          {errors.lateFee && <small role="alert">{errors.lateFee}</small>}
        </label>
        <label className="field">
          Grace period (days)
          <input
            name="graceDays"
            type="number"
            min="0"
            max="31"
            defaultValue={values.graceDays}
            aria-invalid={!!errors.graceDays}
          />
          {errors.graceDays && <small role="alert">{errors.graceDays}</small>}
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
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Saving…' : renewId ? 'Create renewal draft' : 'Create lease'}
      </Button>
    </form>
  );
}

export function EditTermsForm({ leaseId, values }: { leaseId: string; values: TermValues }) {
  const [state, action, pending] = useActionState(editTermsAction, initial);
  return (
    <form className="form" action={action} noValidate id="edit-terms">
      <input type="hidden" name="leaseId" value={leaseId} />
      {state.message && <Alert tone={state.ok ? 'success' : 'warning'}>{state.message}</Alert>}
      <TermFields values={values} errors={state.errors} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save terms'}
      </Button>
    </form>
  );
}

export function LeaseStatusActions({ leaseId, status }: { leaseId: string; status: string }) {
  const [activeState, activate, activating] = useActionState(activateLeaseAction, initial);
  const [endState, terminate, terminating] = useActionState(terminateLeaseAction, initial);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {status === 'DRAFT' && (
        <form action={activate}>
          <input type="hidden" name="leaseId" value={leaseId} />
          <Button type="submit" variant="primary" disabled={activating}>
            Activate lease
          </Button>
        </form>
      )}
      {status === 'ACTIVE' &&
        (confirming ? (
          <form action={terminate} className="row">
            <input type="hidden" name="leaseId" value={leaseId} />
            <span>Terminate this lease?</span>
            <Button type="submit" variant="danger" disabled={terminating}>
              Confirm terminate
            </Button>
            <Button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
            Terminate
          </Button>
        ))}
      {activeState.message && (
        <Alert tone={activeState.ok ? 'success' : 'warning'}>{activeState.message}</Alert>
      )}
      {endState.message && (
        <Alert tone={endState.ok ? 'success' : 'warning'}>{endState.message}</Alert>
      )}
    </div>
  );
}

export function NoticeForm({
  leaseId,
  noticeGivenAt,
  moveOutDate,
}: {
  leaseId: string;
  noticeGivenAt: string;
  moveOutDate: string;
}) {
  const [state, action, pending] = useActionState(recordNoticeAction, initial);
  return (
    <form className="form" action={action} noValidate>
      <input type="hidden" name="leaseId" value={leaseId} />
      {state.message && <Alert tone={state.ok ? 'success' : 'warning'}>{state.message}</Alert>}
      <div className="form-row">
        <label className="field">
          Notice given
          <input name="noticeGivenAt" type="date" defaultValue={noticeGivenAt} required />
        </label>
        <label className="field">
          Planned move-out
          <input name="moveOutDate" type="date" defaultValue={moveOutDate} />
          {state.errors?.moveOutDate && <small role="alert">{state.errors.moveOutDate}</small>}
        </label>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Record notice'}
      </Button>
    </form>
  );
}

export function LeaseUploader({ leaseId }: { leaseId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('targetType', 'lease');
      form.set('targetId', leaseId);
      form.set('kind', 'LEASE');
      const response = await fetch('/api/files', { method: 'POST', body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Upload failed.');
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Uploading…' : '+ Upload document'}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        aria-label="Upload lease document"
        data-testid="upload-lease-document"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      {message && (
        <span role="alert" style={{ color: 'var(--design-danger)' }}>
          {message}
        </span>
      )}
    </>
  );
}
