const DRAFT_NOTICES: Record<string, string> = {
  'draft-deleted': 'Draft lease deleted.',
  'draft-gone': 'That draft was already deleted.',
};

/** The toast for a `?notice=` left by draft deletion, or null for any other value. */
export function draftNotice(value: string | string[] | undefined): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key && Object.hasOwn(DRAFT_NOTICES, key) ? DRAFT_NOTICES[key] : null;
}
