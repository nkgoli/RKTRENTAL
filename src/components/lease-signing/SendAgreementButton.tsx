'use client';
import { useState, useTransition } from 'react';
import { prepareSigningAction } from '@/app/(manager)/leases/new/actions';
export function SendAgreementButton({ leaseId }: { leaseId: string }) {
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        className="btn btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const result = await prepareSigningAction(leaseId);
              if (result.ok) window.location.assign(`/sign/leases/${leaseId}`);
              else setMessage(result.message || 'The agreement could not be prepared.');
            } catch {
              setMessage('The agreement could not be confirmed. Check status before trying again.');
            }
          })
        }
      >
        {pending ? 'Preparing…' : 'Send current agreement for signature'}
      </button>
      {message && <p role="alert">{message}</p>}
      <p className="muted">
        Creates a new signing version only if terms changed. No email or text notification is sent.
      </p>
    </div>
  );
}
