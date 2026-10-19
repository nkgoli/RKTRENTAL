export type ApplyState = {
  ok?: boolean;
  message?: string;
  rent?: number;
  outcome?: 'rejected' | 'unknown';
  inputError?: boolean;
  submittedRent?: string;
};

/** A missing acknowledgement does not establish whether the write committed. */
export const uncertainApply: ApplyState = {
  ok: false,
  outcome: 'unknown',
  message:
    'Couldn’t confirm the update. It may have been saved. Your amount is kept. Retry only if you want to set this amount again.',
};
