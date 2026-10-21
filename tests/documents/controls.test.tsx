// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }));
vi.mock('@/components/upload', () => ({
  FileUploader: ({ target }: { target: { id: string } }) => (
    <div data-testid="uploader">{target.id}</div>
  ),
}));
import { UploadDocumentForm } from '@/app/(manager)/documents/UploadDocumentForm';
import { DocumentFilters } from '@/app/(manager)/documents/DocumentFilters';
afterEach(cleanup);
describe('document destinations and filters', () => {
  const options = {
    leases: [{ id: 'l', label: 'Maple · Unit 4B' }],
    properties: [{ id: 'p', label: 'Maple' }],
    units: [{ id: 'u', label: 'Maple · 4B' }],
  };
  it('requires an explicit destination before an immediate upload', () => {
    render(<UploadDocumentForm {...options} />);
    expect(screen.queryByTestId('uploader')).toBeNull();
    fireEvent.change(screen.getByLabelText('Upload destination'), { target: { value: 'l' } });
    expect(screen.getByTestId('uploader').textContent).toBe('l');
    fireEvent.change(screen.getByLabelText('Attach to'), { target: { value: 'property' } });
    expect(screen.queryByTestId('uploader')).toBeNull();
  });
  it('prefills a valid scoped destination but never an unknown target', () => {
    const view = render(<UploadDocumentForm {...options} unitId="u" />);
    expect(screen.getByTestId('uploader').textContent).toBe('u');
    view.unmount();
    render(<UploadDocumentForm {...options} unitId="outside" />);
    expect(screen.queryByTestId('uploader')).toBeNull();
  });
  it('clears the previous unit and applies the URL when changing property', () => {
    window.history.replaceState(null, '', '/documents?q=inspection&kind=INSPECTION&propertyId=p&unitId=u&filesPage=2');
    render(
      <DocumentFilters
        query="inspection"
        kind="INSPECTION"
        sort="newest"
        propertyId="p"
        unitId="u"
        properties={[
          { id: 'p', name: 'Maple' },
          { id: 'q', name: 'Elm' },
        ]}
        units={[
          { id: 'u', propertyId: 'p', label: 'Maple 4B' },
          { id: 'v', propertyId: 'q', label: 'Elm Home' },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Property'), { target: { value: 'q' } });
    expect((screen.getByLabelText('Unit') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByRole('option', { name: 'Maple 4B' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Elm Home' })).toBeTruthy();
    expect(replace).toHaveBeenCalledWith('/documents?q=inspection&kind=INSPECTION&propertyId=q', { scroll: false });
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });
});
