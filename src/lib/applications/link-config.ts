import {
  createInvitationToken,
  invitationOrigin,
  InvitationError,
  type InvitationEnvironment,
} from './invitation-policy';

/**
 * The same configuration check invitation creation performs (public origin and link secret).
 * Returns an empty string when secure application links can be issued, otherwise the reason.
 */
export function invitationLinkConfigurationError(env: InvitationEnvironment = process.env) {
  try {
    invitationOrigin(env);
    createInvitationToken(env);
    return '';
  } catch (error) {
    return error instanceof InvitationError ? error.message : 'Application links are unavailable.';
  }
}
