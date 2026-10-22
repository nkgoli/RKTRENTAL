import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Action } from '@/components/ui';

describe('workspace Action convention', () => {
  it('keeps a full accessible name and tooltip when the visible text is shortened', () => {
    const html = renderToStaticMarkup(
      <Action icon="edit" text="Edit" label="Edit property" href="/properties/p/edit" />,
    );
    expect(html).toContain('aria-label="Edit property"');
    expect(html).toContain('data-tip="Edit property"');
    expect(html).toContain('<span>Edit</span>');
    expect(html).toContain('aria-hidden="true"');
  });

  it('names icon-only actions and omits redundant labels when text matches', () => {
    const iconOnly = renderToStaticMarkup(
      <Action icon="history" label="Reminder history" href="/notifications" />,
    );
    expect(iconOnly).toContain('class="action action-quiet action-icon"');
    expect(iconOnly).toContain('aria-label="Reminder history"');
    const plain = renderToStaticMarkup(
      <Action icon="arrow-right" trailing text="View lease" label="View lease" href="/leases/1" />,
    );
    expect(plain).not.toContain('aria-label');
    expect(plain).not.toContain('data-tip');
    expect(plain.indexOf('<span>View lease</span>')).toBeLessThan(plain.indexOf('<svg'));
  });

  it('renders buttons with type=button and plain anchors for document navigation', () => {
    const button = renderToStaticMarkup(<Action icon="edit" text="Edit" label="Edit unit" />);
    expect(button).toMatch(
      /^<button class="action action-quiet" type="button" aria-label="Edit unit"/,
    );
    const link = renderToStaticMarkup(
      <Action
        icon="external"
        text="Signing page"
        label="Open signing page"
        href="/sign/leases/1"
        document
      />,
    );
    expect(link).toMatch(/^<a class="action action-quiet" href="\/sign\/leases\/1"/);
  });
});
