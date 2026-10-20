type DraftScope = { requestId: string; propertyId: string; unitId: string };
export const issueDraftKey = (scope: DraftScope) =>
  `maintenance-activity-draft:${scope.propertyId}:${scope.unitId}:${scope.requestId}`;

/** One document-navigation handoff only; never writes issue details to the server. */
export function preserveIssueDraft(scope: DraftScope) {
  const form = Array.from(
    document.querySelectorAll<HTMLFormElement>('form[data-maintenance-issue-id]'),
  ).find((form) => form.dataset.maintenanceIssueId === scope.requestId);
  if (!form) return;
  if (form.getAttribute('aria-busy') === 'true') throw new Error('Issue save in progress');
  const data = new FormData(form);
  sessionStorage.setItem(
    issueDraftKey(scope),
    JSON.stringify({
      title: String(data.get('title') ?? ''),
      description: String(data.get('description') ?? ''),
      priority: String(data.get('priority') ?? 'NORMAL'),
    }),
  );
}

export function restoreIssueDraft(form: HTMLFormElement, scope: DraftScope) {
  const key = issueDraftKey(scope);
  const value = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!value) return false;
  const draft: unknown = JSON.parse(value);
  if (!draft || typeof draft !== 'object') return false;
  for (const name of ['title', 'description', 'priority'] as const) {
    const value = (draft as Record<string, unknown>)[name];
    const field = form.elements.namedItem(name);
    if (
      typeof value !== 'string' ||
      !(
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      )
    )
      return false;
  }
  for (const name of ['title', 'description', 'priority'] as const) {
    const field = form.elements.namedItem(name) as HTMLInputElement;
    field.value = (draft as Record<string, string>)[name];
  }
  return true;
}
