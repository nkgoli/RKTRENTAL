/** Pill text for the payments provider on the Payments tab. The mock provider is the sandbox. */
export function paymentsProviderLabel(
  connection: { provider: string } | null | undefined,
  providerName: string | null,
): string {
  if (!connection) return 'No payments provider connected';
  if (connection.provider === 'mock') return 'Sandbox payments';
  return `${providerName ?? connection.provider} connected`;
}
