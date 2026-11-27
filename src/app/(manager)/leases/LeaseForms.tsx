'use client';

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Alert, Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { saveLeaseAction, type LeaseFormState } from './actions';
import {
  activateDetailLeaseAction,
  editDetailTermsAction,
  recordDetailNoticeAction,
  terminateDetailLeaseAction,
} from './[id]/actions';
import { leaseResultMessages, type LeaseReturnScope } from './[id]/feedback';
import styles from './[id]/lease-detail.module.css';

const initial: LeaseFormState = {};

/** Closes the surrounding FormDisclosure; null when a form is rendered on its own. */
const DisclosureClose = createContext<(() => void) | null>(null);

/**
 * A card's "Edit terms" / "Record notice" button: opening it swaps the card's facts for the form
 * (the card hides its facts while open). It is a native disclosure, so it works before hydration.
 */
export function FormDisclosure({
  label,
  open = false,
  children,
}: {
  label: string;
  open?: boolean;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const userOpened = useRef(false);
  const close = () => {
    if (details.current) details.current.open = false;
    summary.current?.focus();
  };
  return (
    <details
      ref={details}
      className={styles.disclosure}
      open={open}
      onToggle={(event) => {
        // The summary hides while open, so move focus into the form the manager just opened.
        if (!event.currentTarget.open || !userOpened.current) return;
        userOpened.current = false;
        event.currentTarget
          .querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')
          ?.focus();
      }}
    >
      <summary
        ref={summary}
        className="btn btn-secondary btn-sm"
        onClick={() => (userOpened.current = true)}
      >
        {label}
      </summary>
      <div className={styles.disclosureBody}>
        <DisclosureClose.Provider value={close}>{children}</DisclosureClose.Provider>
      </div>
    </details>
  );
}

/** Cancel (or Done after a save) for a form inside a FormDisclosure. */
function CloseButton({ done, disabled, onClose }: { done: boolean; disabled: boolean; onClose: () => void }) {
  const close = useContext(DisclosureClose);
  if (!close) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={() => {
        onClose();
        close();
      }}
    >
      {done ? 'Done' : 'Cancel'}
    </Button>
  );
}

/** A money input with a "$" adornment; the symbol is decorative, the value stays as typed. */
function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={styles.adorned}>
      <span className={styles.prefix} aria-hidden="true">
        $
      </span>
      <input inputMode="decimal" {...props} />
    </span>
  );
}

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
          <MoneyInput
            name="monthlyRent"
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
          <MoneyInput
            name="deposit"
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
          <MoneyInput
            name="lateFee"
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
          <span>
            Grace period<span className={styles.srOnly}> (days)</span>
          </span>
          <span className={styles.adorned}>
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
            <span className={styles.suffix} aria-hidden="true">
              days
            </span>
          </span>
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
  // Cancel restores the saved values and clears the last result.
  const [round, setRound] = useState(0);
  const [cleared, setCleared] = useState<LeaseFormState | null>(null);
  const shown = state === cleared ? initial : state;
  return (
    <form className="form" action={action} noValidate id="edit-terms" aria-label="Edit lease terms">
      <input type="hidden" name="leaseId" value={leaseId} />
      <input type="hidden" name="returnScope" value={returnScope ?? ''} />
      <FormFeedback state={shown} />
      <TermFields key={round} values={values} errors={shown.errors} />
      <div className={styles.formActions}>
        <CloseButton
          done={Boolean(shown.ok)}
          disabled={pending}
          onClose={() => {
            setRound((value) => value + 1);
            setCleared(state);
          }}
        />
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Save terms'}
        </Button>
      </div>
    </form>
  );
}

/** One lease status action: what it does on the left, its button on the right. */
function StatusAction({
  title,
  consequence,
  children,
}: {
  title: string;
  consequence: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.statusAction}>
      <div>
        <strong>{title}</strong>
        <p>{consequence}</p>
      </div>
      {children}
    </div>
  );
}

export function LeaseStatusActions({
  leaseId,
  status,
  returnScope,
  placeLabel = 'this property',
}: {
  leaseId: string;
  status: string;
  returnScope?: LeaseReturnScope;
  placeLabel?: string;
}) {
  const [activeState, activate, activating] = useActionState(activateDetailLeaseAction, initial);
  const [endState, terminate, terminating] = useActionState(terminateDetailLeaseAction, initial);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (endState.message) setConfirming(false);
  }, [endState]);
  return (
    <div className={styles.statusActions}>
      {status === 'DRAFT' && (
        <StatusAction
          title="Activate lease"
          consequence="Marks the unit occupied and adds move-in charges."
        >
          <form action={activate}>
            <input type="hidden" name="leaseId" value={leaseId} />
            <input type="hidden" name="returnScope" value={returnScope ?? ''} />
            <Button type="submit" variant="secondary" disabled={activating} aria-busy={activating}>
              {activating ? 'Activating…' : 'Activate lease'}
            </Button>
          </form>
        </StatusAction>
      )}
      {status === 'ACTIVE' && (
        <StatusAction title="Terminate lease" consequence="Ends the lease and frees the unit.">
          <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
            Terminate
          </Button>
          <ConfirmDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            title={`Terminate lease for ${placeLabel}?`}
            description="Ends this lease and marks the unit vacant if no other active lease remains. Existing charges, payment history and documents stay available."
            confirmLabel={terminating ? 'Terminating…' : 'Terminate lease'}
            pending={terminating}
            action={terminate}
            fields={{ leaseId, returnScope: returnScope ?? '' }}
          />
        </StatusAction>
      )}
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
  // Cancel restores the recorded dates and clears the last result.
  const [cleared, setCleared] = useState<LeaseFormState | null>(null);
  const shown = state === cleared ? initial : state;
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
      <FormFeedback state={shown} />
      <div className="form-row">
        <label className="field">
          Notice given
          <input
            name="noticeGivenAt"
            type="date"
            value={dates.noticeGivenAt}
            onChange={(event) => setDates({ ...dates, noticeGivenAt: event.target.value })}
            required
            aria-invalid={!!shown.errors?.noticeGivenAt}
            aria-describedby={shown.errors?.noticeGivenAt ? fieldId + '-notice-error' : undefined}
          />
          {shown.errors?.noticeGivenAt && (
            <small id={fieldId + '-notice-error'} role="alert">
              {shown.errors.noticeGivenAt}
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
            aria-invalid={!!shown.errors?.moveOutDate}
            aria-describedby={shown.errors?.moveOutDate ? fieldId + '-moveout-error' : undefined}
          />
          {shown.errors?.moveOutDate && (
            <small id={fieldId + '-moveout-error'} role="alert">
              {shown.errors.moveOutDate}
            </small>
          )}
        </label>
      </div>
      <div className={styles.formActions}>
        <CloseButton
          done={Boolean(shown.ok)}
          disabled={pending}
          onClose={() => {
            setDates({ noticeGivenAt, moveOutDate });
            setCleared(state);
          }}
        />
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Save notice'}
        </Button>
      </div>
    </form>
  );
}
