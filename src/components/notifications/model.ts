export type Channel = 'EMAIL' | 'SMS';
export type Recipient = { tenantId: string; recipient: string; subject: string; body: string };
export type ReminderSnapshot = {
  asOf: string;
  amountCents: number;
  pendingCents: number;
  charges: { id?: string; kind: string; dueDate: string; outstandingCents: number }[];
  recipients: Recipient[];
  excluded: { tenantId: string; reason: string }[];
};
export type LeaseChoice = {
  id: string;
  label: string;
  tenants: { id: string; name: string }[];
  EMAIL: ReminderSnapshot;
  SMS: ReminderSnapshot;
};
export type ChannelState = { mode: 'sandbox' | 'live' | 'unavailable'; message: string };
export type Channels = Record<Channel, ChannelState>;
export type Preview = {
  id: string;
  channel: Channel;
  createdAt: string;
  expiresAt: string;
  dispatchedAt?: string | null;
  snapshot: ReminderSnapshot;
  attempts?: Attempt[];
};
export type Attempt = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string | null;
  errorCode?: string | null;
};
export type Draft = { recipients: { tenantId: string; subject: string; body: string }[] };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const statusLabels: Record<string, string> = {
  READY: 'Pending · reserved',
  SENDING: 'Pending · sending',
  MOCK_RECORDED: 'Sandbox · not delivered',
  ACCEPTED: 'Accepted · delivery unconfirmed',
  DELIVERED: 'Delivered · confirmed by provider',
  FAILED: 'Failed · not delivered',
  UNCERTAIN: 'Uncertain · may have been delivered',
  CANCELLED: 'Cancelled · not sent',
};
export const errorMessage = (code: string) =>
  ({
    AUTH_REQUIRED:
      'Your session has expired. Sign in again before continuing. Your draft remains on this page.',
    MANAGER_REQUIRED: 'A current manager account is required. Sign in with a manager account.',
    TRANSPORT_UNCONFIGURED:
      'This channel is unavailable. Ask your administrator to configure the reminder provider in Payment reminder setup.',
    SANDBOX_LIVE_PROVIDER_BLOCKED:
      'Sandbox cannot use a connected live provider. Ask your administrator to remove the live connection or configure a separate test environment.',
    NOT_OVERDUE:
      'This lease no longer has an overdue balance. Refresh the page to see the updated ledger.',
    NO_ELIGIBLE_RECIPIENTS:
      'No eligible contacts for this channel. Review contact details and tenant preferences, or choose another channel.',
    STALE_PREVIEW:
      'The balance, contacts, preferences or preview expiry changed. Your draft is preserved. Preview again before sending.',
    REMINDER_ALREADY_DISPATCHED:
      'A reminder for this balance and channel was already submitted today. Check history before taking another action.',
    PREVIEW_ALREADY_DISPATCHED:
      'This preview was already submitted. Check history for its outcome.',
    UNRESOLVED_DISPATCH:
      'An earlier send is pending or uncertain. Check history and provider status before sending again.',
    MANUAL_RECONCILIATION_REQUIRED:
      'An administrator must check the original provider logs. Delivery remains unconfirmed; do not resend.',
    RECONCILIATION_UNAVAILABLE:
      'Provider status could not be checked. Keep the original operation and try checking again later.',
    REVIEW_OPTIONS_UNAVAILABLE:
      'The reminder service does not yet support edited content or a recipient subset. Your draft is preserved; no message was sent.',
    INVALID_REQUEST:
      'Review your selected recipients and message. A subject must be 1–200 characters and a message 1–2,000 characters.',
  })[code] ??
  'The reminder service is unavailable. Your draft is preserved. Check history before retrying a send.';
