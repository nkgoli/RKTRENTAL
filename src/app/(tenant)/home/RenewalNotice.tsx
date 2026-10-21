'use client';

import { useEffect, useState } from 'react';
import type { LeaseNotice } from '@/lib/tenant-portal/core';

export function RenewalNotice({
  notice,
  storageKey,
  contactEmail,
  managerName,
}: {
  notice: NonNullable<LeaseNotice>;
  storageKey: string;
  contactEmail?: string | null;
  managerName: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === 'dismissed');
    } catch {
      /* Private browsing can disable storage. */
    }
  }, [storageKey]);
  if (dismissed) return null;
  return (
    <section className="alert" aria-label="Lease renewal" style={{ display: 'block' }}>
      <p>
        <strong>{notice.title}</strong>
        <br />
        {notice.body}
      </p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {contactEmail ? (
          <a
            className="btn btn-ghost"
            href={`mailto:${contactEmail}?subject=${encodeURIComponent('Lease renewal')}`}
          >
            Ask about renewal
          </a>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={contactOpen}
            onClick={() => setContactOpen(!contactOpen)}
          >
            Ask about renewal
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          aria-label="Dismiss renewal reminder"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(storageKey, 'dismissed');
            } catch {
              /* Dismiss for this visit even without storage. */
            }
          }}
        >
          Dismiss
        </button>
      </div>
      {contactOpen && (
        <p>Contact {managerName} using the contact details in your lease to ask about renewal.</p>
      )}
    </section>
  );
}
