import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/(manager)/leases/[id]/documentActions', () => ({
  renameLeaseDocumentAction: vi.fn(),
}));

import { LeaseDocumentGrid } from '@/app/(manager)/leases/[id]/LeaseDocumentGrid';

describe('lease documents grid', () => {
  it('renders each file with a download and the available menu actions', () => {
    const html = renderToStaticMarkup(
      <LeaseDocumentGrid
        leaseId="lease-1"
        documents={[
          {
            id: 'doc-1',
            name: 'Signed lease.pdf',
            kind: 'lease',
            uploaded: 'Nov 18, 2025',
            mimeType: 'application/pdf',
          },
          {
            id: 'doc-2',
            name: 'Move-in.jpg',
            kind: 'inspection',
            uploaded: 'Nov 29, 2025',
            mimeType: 'image/jpeg',
          },
        ]}
      />,
    );
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain('/api/files/doc-1/download');
    expect(html).toContain('/api/files/doc-2/download');
    expect(html).toContain('Rename');
    expect(html).toContain('Share with tenant');
    expect(html).toContain('disabled');
    expect(html).toContain('Delete');
  });
});
