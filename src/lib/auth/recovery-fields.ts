export type RecoveryRequestState = {
  email: string;
  error?: string;
  sent?: boolean;
  attempt: number;
};
export type ResetErrors = { password?: string; confirmation?: string };
export type ResetPasswordState = { errors?: ResetErrors; error?: string; attempt: number };

export function validateRecoveryEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email address.';
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return 'Enter a valid email address.';
}

export function validateResetPassword(password: string, confirmation: string): ResetErrors {
  const errors: ResetErrors = {};
  if (password.length < 12) errors.password = 'Use at least 12 characters for your new password.';
  else if (password.length > 128) errors.password = 'Use no more than 128 characters.';
  if (!confirmation) errors.confirmation = 'Enter your new password again.';
  else if (confirmation !== password) errors.confirmation = 'The passwords do not match.';
  return errors;
}
