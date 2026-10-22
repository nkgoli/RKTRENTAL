'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dispatchReminder,
  previewReminder,
  reconcileReminder,
  reminderHistory,
} from '@/app/(manager)/notifications/actions';
import { Steps } from '@/components/ui/Feedback';
import {
  errorMessage,
  money,
  statusLabels,
  type Channel,
  type Channels,
  type Draft,
  type LeaseChoice,
  type Preview,
  type ReminderSnapshot,
} from './model';
import styles from './Reminders.module.css';
import {
  pendingOperations,
  rememberOperation,
  forgetOperation,
  type Pending,
} from './pending-operation';

type Editor = { selected: string[]; messages: Record<string, { subject: string; body: string }> };

/**
 * Preselects the requested tenant while they are still eligible (never a co-tenant in their
 * place), otherwise the only eligible recipient.
 */
function initialEditor(snapshot: ReminderSnapshot, tenantId?: string): Editor {
  return {
    selected: tenantId
      ? snapshot.recipients.some((r) => r.tenantId === tenantId)
        ? [tenantId]
        : []
      : snapshot.recipients.length === 1
        ? [snapshot.recipients[0].tenantId]
        : [],
    messages: Object.fromEntries(
      snapshot.recipients.map((r) => [r.tenantId, { subject: r.subject, body: r.body }]),
    ),
  };
}

const STEPS = ['Balance', 'Message', 'Recipients', 'Confirm'];

function ChargeSummary({ snapshot }: { snapshot: ReminderSnapshot }) {
  const fees = snapshot.charges
    .filter((c) => c.kind === 'LATE_FEE')
    .reduce((sum, c) => sum + c.outstandingCents, 0);
  return (
    <section className={styles.balance} aria-label="Overdue charges">
      <div className={styles.balanceHead}>
        <div>
          <p className={styles.balanceLabel}>Overdue · all dates</p>
          <strong>{money(snapshot.amountCents)}</strong>
        </div>
        <span className={styles.muted}>As of {snapshot.asOf} UTC</span>
      </div>
      <p>
        Remaining rent and other charges {money(snapshot.amountCents - fees)}{' '}
        <span>· Assessed late fees {money(fees)}</span>
      </p>
      <p className={styles.muted}>Shared lease balance. No new fees are added by this reminder.</p>
      {snapshot.pendingCents > 0 && (
        <p className={styles.warning}>
          {money(snapshot.pendingCents)} pending payment · not yet settled or deducted.
        </p>
      )}
      <ul className={styles.charges}>
        {snapshot.charges.map((c) => (
          <li key={c.id}>
            <span>
              {c.kind === 'LATE_FEE'
                ? 'Assessed late fee'
                : c.kind === 'RENT'
                  ? 'Rent'
                  : c.kind === 'DEPOSIT'
                    ? 'Deposit'
                    : 'Other charge'}
              <small>Due {c.dueDate}</small>
            </span>
            <strong>{money(c.outstandingCents)} remaining</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReminderWorkspace({
  choices,
  channels,
  initialLeaseId,
  initialTenantId,
  fromRentRoll = false,
  historyFirst = false,
  storageKey,
  lockedLeaseId,
}: {
  choices: LeaseChoice[];
  channels: Channels;
  /**
   * Review one lease only (the lease Rent ledger): the lease picker is hidden and the URL is left
   * alone. The lease must be in `choices`.
   */
  lockedLeaseId?: string;
  initialLeaseId?: string;
  /** The rent-roll row's tenant, preselected only when eligible for the chosen channel. */
  initialTenantId?: string;
  /** Opened from a rent-roll row menu, whose Late label may predate the current ledger. */
  fromRentRoll?: boolean;
  historyFirst?: boolean;
  storageKey: string;
}) {
  const overdue = choices.filter((c) => c.EMAIL.amountCents > 0);
  const [leaseId, setLeaseId] = useState(() =>
    lockedLeaseId
      ? choices.some((c) => c.id === lockedLeaseId)
        ? lockedLeaseId
        : ''
      : choices.some((c) => c.id === initialLeaseId)
        ? initialLeaseId!
        : overdue.length === 1
          ? overdue[0].id
          : choices.length === 1
            ? choices[0].id
            : '',
  );
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [editors, setEditors] = useState<Record<string, Editor>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<Preview[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [sent, setSent] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const lease = choices.find((c) => c.id === leaseId);
  const snapshot = lease?.[channel];
  const editorKey = `${leaseId}:${channel}`;
  const editor =
    editors[editorKey] ??
    (snapshot
      ? initialEditor(snapshot, leaseId === initialLeaseId ? initialTenantId : undefined)
      : { selected: [], messages: {} });
  const initialMissing = Boolean(initialLeaseId) && !choices.some((c) => c.id === initialLeaseId);
  const channelState = channels[channel];
  const blocked = Boolean(busy || pending);

  useEffect(() => {
    if (preview) reviewHeading.current?.focus();
  }, [preview]);

  useEffect(() => {
    if (historyFirst && leaseId) historyHeading.current?.focus();
  }, [historyFirst, leaseId]);

  useEffect(() => {
    const operation = pendingOperations(storageKey).find((p) =>
      choices.some((c) => c.id === p.leaseId),
    );
    if (operation) {
      setPending(operation);
      setLeaseId(operation.leaseId);
      setNotice(
        'An earlier send has an unconfirmed response. Check its original operation before starting another reminder.',
      );
    }
  }, [storageKey, choices]);

  useEffect(() => {
    let active = true;
    setHistory([]);
    setHistoryError('');
    if (!leaseId) return;
    setHistoryLoading(true);
    reminderHistory(leaseId)
      .then((r) => {
        if (!active) return;
        if (r.ok) setHistory(r.value);
        else setHistoryError(errorMessage(r.error));
      })
      .catch(() => {
        if (active)
          setHistoryError('History is unavailable. Try refreshing history before sending.');
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leaseId]);

  const refreshHistory = useCallback(async () => {
    if (!leaseId) return;
    setHistoryLoading(true);
    try {
      const r = await reminderHistory(leaseId);
      if (r.ok) {
        setHistory(r.value);
        setHistoryError('');
      } else setHistoryError(errorMessage(r.error));
    } catch {
      setHistoryError('History is unavailable. Try again before sending.');
    } finally {
      setHistoryLoading(false);
    }
  }, [leaseId]);

  function updateEditor(next: Editor) {
    setEditors((all) => ({ ...all, [editorKey]: next }));
    setPreview(null);
    setSent(false);
    setError('');
    setNotice('');
  }

  /** Discards this lease and channel's edits and any unsent preview; nothing is sent. */
  function cancelDraft() {
    setEditors((all) => {
      const next = { ...all };
      delete next[editorKey];
      return next;
    });
    setPreview(null);
    setError('');
    setNotice('');
  }

  async function createPreview() {
    if (lock.current || pending || !snapshot) return;
    lock.current = true;
    setBusy('preview');
    setError('');
    setNotice('');
    const draft: Draft = {
      recipients: snapshot.recipients
        .filter((r) => editor.selected.includes(r.tenantId))
        .map((r) => ({ tenantId: r.tenantId, ...editor.messages[r.tenantId] })),
    };
    try {
      const r = await previewReminder(leaseId, channel, draft);
      if (r.ok) {
        if (
          r.value.snapshot.transport &&
          (r.value.snapshot.transport === 'mock') !== (channelState.mode === 'sandbox')
        ) {
          setPreview(null);
          setError(
            'Delivery configuration changed. Your draft is preserved. Refresh channel availability before previewing again.',
          );
          return;
        }
        setPreview(r.value);
        setSent(false);
      } else {
        setPreview(null);
        setError(errorMessage(r.error));
      }
    } catch {
      setError('Preview could not be loaded. Your draft is preserved. Try previewing again.');
    } finally {
      lock.current = false;
      setBusy('');
    }
  }

  async function send(original?: Pending) {
    if (lock.current || (!preview && !original)) return;
    lock.current = true;
    const operation = original ?? { leaseId, previewId: preview!.id, key: crypto.randomUUID() };
    setPending(operation);
    setBusy('send');
    setError('');
    setNotice('');
    rememberOperation(storageKey, operation);
    try {
      const r = await dispatchReminder(operation.previewId, operation.key);
      if (r.ok) {
        setHistory((all) => [r.value, ...all.filter((p) => p.id !== r.value.id)]);
        setSent(true);
        setPreview(null);
        if (r.value.attempts?.some((a) => ['READY', 'SENDING', 'UNCERTAIN'].includes(a.status))) {
          setPending(operation);
        } else {
          setPending(null);
          forgetOperation(storageKey, operation.leaseId);
        }
        setNotice(
          r.value.attempts?.every((a) => a.status === 'MOCK_RECORDED')
            ? 'Sandbox test recorded. No email or text was delivered. See history below.'
            : 'Send response recorded. Review each recipient’s status in history; acceptance does not confirm delivery.',
        );
      } else {
        // An error response may follow a committed provider operation. Preserve the original key.
        setError(errorMessage(r.error));
        if (
          (r.error === 'STALE_PREVIEW' || !original) &&
          [
            'STALE_PREVIEW',
            'TRANSPORT_UNCONFIGURED',
            'SANDBOX_LIVE_PROVIDER_BLOCKED',
            'NOT_OVERDUE',
            'NO_ELIGIBLE_RECIPIENTS',
            'UNRESOLVED_DISPATCH',
            'REMINDER_ALREADY_DISPATCHED',
          ].includes(r.error)
        ) {
          setPending(null);
          setPreview(null);
          forgetOperation(storageKey, operation.leaseId);
        }
        await refreshHistory();
      }
    } catch {
      setError(
        'Send response was interrupted. Delivery is unconfirmed. Your draft and original operation are preserved. Check history, then check the original send; do not start another reminder.',
      );
    } finally {
      lock.current = false;
      setBusy('');
    }
  }

  async function checkStatus(attemptId: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(attemptId);
    setError('');
    try {
      const r = await reconcileReminder(attemptId);
      if (!r.ok) setError(errorMessage(r.error));
      await refreshHistory();
    } catch {
      setError('Status could not be checked. Keep the original operation and try again later.');
    } finally {
      lock.current = false;
      setBusy('');
    }
  }

  const step = preview ? 3 : editor.selected.length ? 2 : 1;
  const hasBalance = Boolean(snapshot && snapshot.amountCents > 0);

  return (
    <div className={styles.workspace}>
      {lockedLeaseId && !lease && (
        <p className={styles.muted}>This lease is not available for payment reminders.</p>
      )}
      {!lockedLeaseId && (
        <section className={`card ${styles.selection}`}>
          <div>
            <p className="eyebrow">Payment reminders</p>
            <h2>Choose a lease</h2>
            <p className={styles.muted}>
              Review the balance and choose who receives a reminder. Each message uses the shared
              lease balance.
            </p>
          </div>
          <label className={styles.field}>
            Lease
            <select
              value={leaseId}
              disabled={blocked}
              onChange={(e) => {
                setLeaseId(e.target.value);
                const url = new URL(window.location.href);
                if (e.target.value) url.searchParams.set('leaseId', e.target.value);
                else url.searchParams.delete('leaseId');
                window.history.replaceState(null, '', url);
                setPreview(null);
                setError('');
                setNotice('');
                setSent(false);
              }}
            >
              <option value="">
                Choose a lease{overdue.length > 1 ? ` · ${overdue.length} overdue` : ''}
              </option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ·{' '}
                  {c.EMAIL.amountCents > 0
                    ? `${money(c.EMAIL.amountCents)} overdue`
                    : 'No overdue balance'}
                </option>
              ))}
            </select>
          </label>
          {initialMissing && (
            <p className={styles.warning} role="alert">
              The lease you opened is no longer available for reminders in this scope. Nothing was
              selected or sent; choose a lease to continue.
            </p>
          )}
          {fromRentRoll && lease && leaseId === initialLeaseId && (
            <p className={styles.muted}>
              Opened from the rent roll
              {initialTenantId && lease.tenants.some((t) => t.id === initialTenantId)
                ? ` for ${lease.tenants.find((t) => t.id === initialTenantId)!.name}`
                : ''}
              . Balance and contacts below are current; nothing is sent until you confirm.
            </p>
          )}
          {!leaseId && (
            <p className={styles.muted}>
              Select one lease to compose a reminder or inspect its history. No recipient is
              selected across leases.
            </p>
          )}
          {!overdue.length && (
            <p className={styles.good}>
              No overdue balances in this scope. You can still inspect previous reminders.
            </p>
          )}
        </section>
      )}

      {error && (
        <div className={styles.alert} role="alert">
          {error} <Link href="/integrations#payment-reminders">Payment reminder setup</Link>
        </div>
      )}
      {notice && (
        <div className={styles.info} role="status">
          {notice}
        </div>
      )}
      {pending && (
        <section className={`card ${styles.recovery}`} aria-label="Original send recovery">
          <h3>Check the original send</h3>
          <p>
            Your original send is retained to prevent duplicates. Refresh history or request the
            same operation’s result.
          </p>
          <div className={styles.actions}>
            <button
              className="btn btn-primary"
              disabled={Boolean(busy)}
              onClick={() => send(pending)}
            >
              {busy === 'send' ? 'Checking…' : 'Check original send'}
            </button>
            <button
              className="btn btn-secondary"
              disabled={historyLoading || Boolean(busy)}
              onClick={refreshHistory}
            >
              Refresh history
            </button>
          </div>
        </section>
      )}

      {lease && snapshot && (
        <div className={styles.columns} data-compose={hasBalance}>
          <div className={styles.summaryArea}>
            {hasBalance ? (
              <section className="card" aria-labelledby="reminder-balance-heading">
                <p className={`eyebrow ${styles.dangerEyebrow}`}>
                  Late-rent reminder · step {step + 1} of 4
                </p>
                <h2 id="reminder-balance-heading">
                  Remind {lease.tenants.map((t) => t.name).join(' & ') || 'tenants'} about{' '}
                  {money(snapshot.amountCents)}
                </h2>
                <p className={styles.muted}>
                  {lease.label}. Review the balance first; nothing is sent until you confirm.
                </p>
                <ChargeSummary snapshot={snapshot} />
              </section>
            ) : (
              <section className="card">
                <h2>All caught up</h2>
                <p>No overdue balance for this lease. A reminder cannot be sent.</p>
                {fromRentRoll && leaseId === initialLeaseId && (
                  <p>
                    The rent roll showed this lease as late, but the current ledger has no overdue
                    balance — it may have been paid since the rent roll loaded.
                  </p>
                )}
                <p className={styles.muted}>
                  History remains available, including sandbox tests and previous send outcomes.
                </p>
              </section>
            )}
          </div>
          {hasBalance && (
            <div className={styles.compose}>
              <>
                <section className="card" aria-labelledby="compose-heading">
                  <h2 id="compose-heading">Compose reminder</h2>
                  <Steps steps={STEPS} current={step} />
                  <fieldset className={styles.channel} disabled={blocked}>
                    <legend>Delivery channel</legend>
                    {(['EMAIL', 'SMS'] as const).map((c) => (
                      <label key={c}>
                        <input
                          type="radio"
                          name="channel"
                          value={c}
                          checked={channel === c}
                          onChange={() => {
                            setChannel(c);
                            setPreview(null);
                            setError('');
                            setNotice('');
                            setSent(false);
                          }}
                        />
                        {c === 'EMAIL' ? 'Email' : 'Text message (SMS)'}
                      </label>
                    ))}
                  </fieldset>
                  <div
                    className={`alert ${channelState.mode === 'unavailable' ? 'error' : channelState.mode === 'sandbox' ? 'warning' : ''} ${styles.channelNote}`}
                  >
                    <strong>
                      {channelState.mode === 'sandbox'
                        ? 'Sandbox · not delivered'
                        : channelState.mode === 'unavailable'
                          ? 'Channel unavailable'
                          : 'Live channel'}
                    </strong>
                    <p>{channelState.message}</p>
                    {channelState.mode === 'unavailable' && (
                      <Link href="/integrations#payment-reminders">
                        Open payment reminder setup
                      </Link>
                    )}
                  </div>
                  <fieldset className={styles.recipients} disabled={blocked}>
                    <legend>
                      Recipients {snapshot.recipients.length > 1 ? '· choose explicitly' : ''}
                    </legend>
                    {!snapshot.recipients.length && (
                      <p>
                        No eligible contacts. Choose another channel, correct the tenant’s contact
                        information, or ask the tenant to review their reminder preferences.
                      </p>
                    )}
                    {snapshot.recipients.map((r) => (
                      <label key={r.tenantId}>
                        <input
                          type="checkbox"
                          checked={editor.selected.includes(r.tenantId)}
                          onChange={(e) =>
                            updateEditor({
                              ...editor,
                              selected: e.target.checked
                                ? [...editor.selected, r.tenantId]
                                : editor.selected.filter((id) => id !== r.tenantId),
                            })
                          }
                        />
                        <span>
                          <strong>
                            {lease.tenants.find((t) => t.id === r.tenantId)?.name ?? 'Tenant'}
                          </strong>
                          <small>{r.recipient}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {snapshot.excluded.length > 0 && (
                    <ul className={styles.excluded}>
                      {snapshot.excluded.map((e) => (
                        <li key={e.tenantId}>
                          {lease.tenants.find((t) => t.id === e.tenantId)?.name ?? 'Tenant'}:{' '}
                          {e.reason === 'OPTED_OUT'
                            ? 'opted out · ask the tenant to review their preferences; do not override consent'
                            : 'missing or invalid contact · update tenant details (SMS needs a +country code)'}
                          . <Link href={`/tenants/${e.tenantId}`}>Open tenant</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {snapshot.recipients
                    .filter((r) => editor.selected.includes(r.tenantId))
                    .map((r) => (
                      <div key={r.tenantId} className={styles.messageEditor}>
                        <h3>
                          Message for{' '}
                          {lease.tenants.find((t) => t.id === r.tenantId)?.name ?? r.recipient}
                        </h3>
                        {channel === 'EMAIL' && (
                          <label className={styles.field}>
                            Subject
                            <input
                              required
                              maxLength={200}
                              value={editor.messages[r.tenantId].subject}
                              disabled={blocked}
                              onChange={(e) =>
                                updateEditor({
                                  ...editor,
                                  messages: {
                                    ...editor.messages,
                                    [r.tenantId]: {
                                      ...editor.messages[r.tenantId],
                                      subject: e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                        )}
                        <label className={styles.field}>
                          Message
                          <textarea
                            required
                            maxLength={2000}
                            rows={7}
                            value={editor.messages[r.tenantId].body}
                            disabled={blocked}
                            onChange={(e) =>
                              updateEditor({
                                ...editor,
                                messages: {
                                  ...editor.messages,
                                  [r.tenantId]: {
                                    ...editor.messages[r.tenantId],
                                    body: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                          <small>
                            {editor.messages[r.tenantId].body.length}/2,000 characters
                            {channel === 'SMS' ? ' · long texts may use multiple SMS segments' : ''}
                          </small>
                        </label>
                      </div>
                    ))}
                  <div className={styles.actions}>
                    <button
                      className="btn btn-primary"
                      onClick={createPreview}
                      disabled={
                        blocked ||
                        sent ||
                        !editor.selected.length ||
                        channelState.mode === 'unavailable' ||
                        editor.selected.some(
                          (id) =>
                            !editor.messages[id]?.subject.trim() ||
                            !editor.messages[id]?.body.trim(),
                        )
                      }
                    >
                      {busy === 'preview' ? 'Preparing preview…' : 'Preview reminder'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={blocked}
                      onClick={cancelDraft}
                      aria-label="Cancel: discard edits to this draft"
                    >
                      Cancel
                    </button>
                    <small className={styles.muted}>Preview first, then confirm the send.</small>
                  </div>
                </section>
                {preview && (
                  <section className={`card ${styles.review}`} aria-labelledby="review-heading">
                    <p className="eyebrow">Step 4 of 4 · Confirm</p>
                    <h2 ref={reviewHeading} tabIndex={-1} id="review-heading">
                      Confirm {channelState.mode === 'sandbox' ? 'sandbox ' : ''}reminder
                    </h2>
                    <Steps steps={STEPS} current={3} />
                    <dl className={styles.recap}>
                      <div>
                        <dt>Recipient</dt>
                        <dd>{preview.snapshot.recipients.map((r) => r.recipient).join(', ')}</dd>
                      </div>
                      <div>
                        <dt>Channel</dt>
                        <dd>{preview.channel === 'EMAIL' ? 'Email' : 'Text message (SMS)'}</dd>
                      </div>
                      <div>
                        <dt>Lease</dt>
                        <dd>{lease.label}</dd>
                      </div>
                      <div>
                        <dt>Balance quoted</dt>
                        <dd>{money(preview.snapshot.amountCents)}</dd>
                      </div>
                    </dl>
                    <p className={styles.muted}>
                      Expires {new Date(preview.expiresAt).toLocaleString()} · edits require a new
                      preview.
                    </p>
                    {preview.snapshot.recipients.map((r) => (
                      <article className={styles.messagePreview} key={r.tenantId}>
                        <p>
                          <strong>
                            {preview.channel === 'EMAIL' ? 'Email to' : 'SMS to'} {r.recipient}
                          </strong>
                        </p>
                        {preview.channel === 'EMAIL' && <h3>{r.subject}</h3>}
                        <p className={styles.messageBody}>{r.body}</p>
                      </article>
                    ))}
                    <details className={styles.quoted}>
                      <summary>Charges in the quoted balance</summary>
                      <ChargeSummary snapshot={preview.snapshot} />
                    </details>
                    <div
                      className={`alert ${channelState.mode === 'sandbox' ? 'warning' : ''} ${styles.channelNote}`}
                    >
                      {channelState.mode === 'sandbox'
                        ? 'Sandbox · this only records a test attempt. No recipient will be contacted.'
                        : 'Confirm the recipients, channel and content. A submitted message may be impossible to recall.'}
                    </div>
                    <div className={`${styles.actions} ${styles.confirmActions}`}>
                      <button className="btn btn-primary" disabled={blocked} onClick={() => send()}>
                        {busy === 'send'
                          ? 'Submitting…'
                          : channelState.mode === 'sandbox'
                            ? 'Record sandbox test · not delivered'
                            : `Send ${preview.channel === 'EMAIL' ? 'email' : 'text'} reminder`}
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={blocked}
                        onClick={() => {
                          setPreview(null);
                        }}
                      >
                        Back to edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={blocked}
                        onClick={cancelDraft}
                        aria-label="Cancel: discard this preview and draft"
                      >
                        Cancel
                      </button>
                    </div>
                  </section>
                )}
              </>
            </div>
          )}

          <section
            className={`card ${styles.history}`}
            id="reminder-history"
            aria-labelledby="history-heading"
          >
            <div className={styles.historyHead}>
              <div>
                <p className="eyebrow">Persistent record</p>
                <h2 ref={historyHeading} tabIndex={-1} id="history-heading">
                  Reminder history
                </h2>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={historyLoading || Boolean(busy)}
                onClick={refreshHistory}
              >
                {historyLoading ? 'Loading…' : 'Refresh history'}
              </button>
            </div>
            <p className={styles.muted}>
              Latest 100 sends for the selected lease. Times use your device’s time zone.
            </p>
            {historyError ? (
              <p role="alert" className={styles.warning}>
                {historyError}
              </p>
            ) : historyLoading ? (
              <p role="status">Loading history…</p>
            ) : !history.length ? (
              <p className={styles.emptyHistory}>
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                No reminders submitted for this lease.
              </p>
            ) : (
              <ol className={styles.historyList}>
                {history.map((p) => (
                  <li key={p.id}>
                    <div className={styles.historyMeta}>
                      <strong>{p.channel === 'EMAIL' ? 'Email' : 'Text message'}</strong>
                      <time dateTime={p.dispatchedAt ?? p.createdAt}>
                        {new Date(p.dispatchedAt ?? p.createdAt).toLocaleString()}
                      </time>
                    </div>
                    {p.attempts?.map((a) => (
                      <article className={styles.attempt} key={a.id}>
                        <strong
                          className={
                            ['FAILED', 'UNCERTAIN'].includes(a.status)
                              ? styles.warning
                              : a.status === 'DELIVERED'
                                ? styles.good
                                : ''
                          }
                        >
                          {statusLabels[a.status] ??
                            'Unrecognized status · check with administrator'}
                        </strong>
                        <p>{a.recipient}</p>
                        <small>
                          Updated{' '}
                          <time dateTime={a.updatedAt}>
                            {new Date(a.updatedAt).toLocaleString()}
                          </time>
                        </small>
                        {a.provider === 'mock' && (
                          <p className={styles.muted}>Sandbox record only · no delivery.</p>
                        )}
                        {a.errorCode && (
                          <p className={styles.warning}>
                            {a.errorCode === 'SMS_OPTED_OUT'
                              ? 'Recipient opted out. SMS reminders are now disabled.'
                              : `Provider result: ${a.errorCode}. Check with your administrator.`}
                          </p>
                        )}
                        <details>
                          <summary>View recorded message</summary>
                          {p.channel === 'EMAIL' && <h3>{a.subject}</h3>}
                          <p className={styles.messageBody}>{a.body}</p>
                        </details>
                        {['READY', 'SENDING', 'UNCERTAIN', 'ACCEPTED'].includes(a.status) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={Boolean(busy)}
                            onClick={() => checkStatus(a.id)}
                          >
                            {busy === a.id ? 'Checking…' : 'Check provider status'}
                          </button>
                        )}
                      </article>
                    ))}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
