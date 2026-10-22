'use client';

import { useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import styles from './applications.module.css';

const reasons = [
  { value: 'criteria-met', label: 'Meets written screening criteria' },
  { value: 'credit-below-criteria', label: 'Credit score below written criteria' },
  { value: 'background-review', label: 'Background report requires review' },
  { value: 'eviction-review', label: 'Eviction report requires review' },
  { value: 'application-incomplete', label: 'Application information incomplete' },
];

export function ScreeningSubmit({ disabled, again }: { disabled: boolean; again: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      disabled={disabled || pending}
      aria-describedby="screening-help"
    >
      {pending ? 'Requesting screening…' : again ? 'Run screening again' : 'Run screening'}
    </Button>
  );
}

function DecisionButtons({
  reason,
  onDecline,
  helpId,
}: {
  reason: string;
  onDecline: () => void;
  helpId: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className={styles.decisionButtons}>
      <Button
        type="button"
        name="decision"
        value="DECLINED"
        variant="secondary"
        onClick={onDecline}
        aria-describedby={helpId}
        disabled={
          pending || !reasons.some((item) => item.value === reason && item.value !== 'criteria-met')
        }
      >
        Decline
      </Button>
      <Button
        type="submit"
        name="decision"
        value="APPROVED"
        variant="primary"
        aria-describedby={helpId}
        disabled={pending || reason !== 'criteria-met'}
      >
        {pending ? 'Saving decision…' : 'Approve'}
      </Button>
    </div>
  );
}

export function ReviewDecisionForm({
  action,
  applicationId,
  propertyId,
  unitId,
}: {
  action: (data: FormData) => Promise<void>;
  applicationId: string;
  propertyId?: string;
  unitId?: string;
}) {
  const [reason, setReason] = useState('');
  const [confirmDecline, setConfirmDecline] = useState(false);
  const id = useId();
  return (
    <>
      <form action={action} className={styles.decisionForm}>
        <input type="hidden" name="applicationId" value={applicationId} />
        {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
        {unitId && <input type="hidden" name="unitId" value={unitId} />}
        <label className="field">
          <span className="field-label">Decision reason</span>
          <select
            name="reason"
            aria-label="Decision reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            aria-describedby={`${id}-value ${id}-help`}
          >
            <option value="" disabled>
              Select a written screening reason
            </option>
            {reasons.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <small id={`${id}-value`} aria-live="polite">
            {reasons.find((item) => item.value === reason)?.label ??
              'Select a written screening reason'}
          </small>
          <small id={`${id}-help`}>
            Choose “Meets written screening criteria” to approve, or a specific reason to decline.
            After approval, Promote to tenant appears here.
          </small>
        </label>
        <DecisionButtons
          reason={reason}
          helpId={`${id}-help`}
          onDecline={() => setConfirmDecline(true)}
        />
      </form>
      <ConfirmDialog
        open={confirmDecline}
        onClose={() => setConfirmDecline(false)}
        title="Decline this application?"
        description="This records the selected screening reason and declines the application. Review the applicant’s report and written criteria before continuing."
        confirmLabel="Decline application"
        action={action}
        fields={{ applicationId, propertyId, unitId, reason, decision: 'DECLINED' }}
      />
    </>
  );
}
