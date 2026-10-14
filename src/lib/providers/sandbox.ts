export function isSandboxEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ROCKETRENTAL_SANDBOX === 'true';
}

export function requireSandboxEnabled(env: Record<string, string | undefined> = process.env): void {
  if (!isSandboxEnabled(env)) throw new Error('Mock providers require ROCKETRENTAL_SANDBOX=true');
}
