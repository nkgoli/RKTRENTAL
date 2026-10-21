export type SignInErrors = { email?: string; password?: string };

export type SignInState = {
  email: string;
  errors?: SignInErrors;
  message?: string;
  attempt: number;
};

export const INVALID_CREDENTIALS =
  'Email or password was not recognized. Check your details and try again.';

export function validateSignIn(email: string, password: string): SignInErrors {
  const errors: SignInErrors = {};
  if (!email.trim()) errors.email = 'Enter your email address.';
  else if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  else if (password.length > 1024) errors.password = 'Your password is too long.';
  return errors;
}
