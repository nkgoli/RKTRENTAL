export type Pending = { leaseId: string; previewId: string; key: string };

/** Keep recovery keys for other scopes when a manager opens another unit. No message/contact data. */
export function pendingOperations(storageKey: string): Pending[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}');
    const rows = typeof stored?.leaseId === 'string' ? [stored] : Object.values(stored ?? {});
    return rows.filter((row): row is Pending =>
      Boolean(
        row &&
        typeof row === 'object' &&
        'leaseId' in row &&
        typeof row.leaseId === 'string' &&
        row.leaseId &&
        'previewId' in row &&
        typeof row.previewId === 'string' &&
        row.previewId &&
        'key' in row &&
        typeof row.key === 'string' &&
        row.key,
      ),
    );
  } catch {
    return [];
  }
}

export function rememberOperation(storageKey: string, operation: Pending) {
  try {
    const rows = pendingOperations(storageKey).filter((p) => p.leaseId !== operation.leaseId);
    sessionStorage.setItem(
      storageKey,
      JSON.stringify(Object.fromEntries([...rows, operation].map((p) => [p.leaseId, p]))),
    );
  } catch {
    /* Server duplicate protection remains in force without browser storage. */
  }
}

export function forgetOperation(storageKey: string, leaseId: string) {
  try {
    const rows = pendingOperations(storageKey).filter((p) => p.leaseId !== leaseId);
    if (rows.length)
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(Object.fromEntries(rows.map((p) => [p.leaseId, p]))),
      );
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* Optional browser recovery storage. */
  }
}
