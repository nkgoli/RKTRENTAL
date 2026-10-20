// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import {
  issueDraftKey,
  preserveIssueDraft,
  restoreIssueDraft,
} from '@/components/maintenance/issue-draft';
const scope = { requestId: 'r', propertyId: 'p', unitId: 'u' };
afterEach(() => {
  document.body.innerHTML = '';
  sessionStorage.clear();
});
function form() {
  document.body.innerHTML =
    '<form data-maintenance-issue-id="r"><input name="title" value="Original"><textarea name="description">Original description</textarea><select name="priority"><option>LOW</option><option>NORMAL</option></select></form>';
  return document.querySelector('form')!;
}
it('hands off current issue values once without changing saved defaults', () => {
  const source = form();
  (source.elements.namedItem('title') as HTMLInputElement).value = 'Unsaved';
  (source.elements.namedItem('description') as HTMLTextAreaElement).value = 'Draft description';
  (source.elements.namedItem('priority') as HTMLSelectElement).value = 'NORMAL';
  preserveIssueDraft(scope);
  const destination = form();
  expect(restoreIssueDraft(destination, scope)).toBe(true);
  expect((destination.elements.namedItem('title') as HTMLInputElement).value).toBe('Unsaved');
  expect((destination.elements.namedItem('title') as HTMLInputElement).defaultValue).toBe(
    'Original',
  );
  expect((destination.elements.namedItem('description') as HTMLTextAreaElement).value).toBe(
    'Draft description',
  );
  expect((destination.elements.namedItem('priority') as HTMLSelectElement).value).toBe('NORMAL');
  expect(sessionStorage.getItem(issueDraftKey(scope))).toBeNull();
  expect(restoreIssueDraft(form(), scope)).toBe(false);
});
it('keeps unrelated request scopes separate', () => {
  form();
  preserveIssueDraft({ ...scope, requestId: 'other' });
  expect(sessionStorage.length).toBe(0);
});
it('prevents navigation handoff while issue details are saving', () => {
  form().setAttribute('aria-busy', 'true');
  expect(() => preserveIssueDraft(scope)).toThrow('Issue save in progress');
  expect(sessionStorage.length).toBe(0);
});
