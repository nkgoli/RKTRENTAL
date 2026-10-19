'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import styles from './applications.module.css';

export function ScreeningSubmit({ disabled, again }: { disabled: boolean; again: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={disabled || pending}>
      {pending ? 'Requesting screening…' : again ? 'Run screening again' : 'Run screening'}
    </Button>
  );
}

function DecisionButtons({ reason }: { reason: string }) {
  const { pending } = useFormStatus();
  return (
    <div className={styles.decisionButtons}>
      <Button
        type="submit"
        name="decision"
        value="DECLINED"
        variant="danger"
        disabled={pending || !reason || reason === 'criteria-met'}
      >
        Decline
      </Button>
      <Button
        type="submit"
        name="decision"
        value="APPROVED"
        variant="primary"
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
  return (
    <form action={action} className={styles.decisionForm}>
      <input type="hidden" name="applicationId" value={applicationId} />
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      {unitId && <input type="hidden" name="unitId" value={unitId} />}
      <label>
        <span>Decision reason</span>
        <select
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          aria-describedby="decision-help"
        >
          <option value="" disabled>
            Select a written screening reason
          </option>
          <option value="criteria-met">Meets written screening criteria</option>
          <option value="credit-below-criteria">Credit score below written criteria</option>
          <option value="background-review">Background report requires review</option>
          <option value="eviction-review">Eviction report requires review</option>
          <option value="application-incomplete">Application information incomplete</option>
        </select>
        <small id="decision-help">
          Select “Meets written screening criteria” to approve, or a specific reason to decline.
        </small>
      </label>
      <DecisionButtons reason={reason} />
    </form>
  );
}
