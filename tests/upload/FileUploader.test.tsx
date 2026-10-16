// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUploader, type UploadFileFn } from '../../src/components/upload/FileUploader';

beforeEach(() => {
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

function imageFile(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, { type: 'image/jpeg' });
}

function chooseFiles(files: File[]) {
  const input = screen.getByLabelText(/^Choose (files|a file)$/) as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
  return input;
}

const okUpload: UploadFileFn = async (file, { onProgress }) => {
  onProgress(50);
  onProgress(100);
  return { id: `doc-${file.name}`, name: file.name };
};

describe('FileUploader', () => {
  it('uploads multiple photos with thumbnails, progress and the N of max counter', async () => {
    const onUploaded = vi.fn();
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'property', id: 'property-1' }}
        max={20}
        uploadFile={okUpload}
        onUploaded={onUploaded}
      />,
    );
    expect(screen.getByText('0 of 20 photos')).toBeTruthy();
    chooseFiles([imageFile('front.jpg'), imageFile('kitchen.jpg')]);
    expect(screen.getByText('2 of 20 photos')).toBeTruthy();
    const images = document.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toBe('blob:front.jpg');
    await waitFor(() => expect(screen.getAllByText('Uploaded')).toHaveLength(2));
    expect(onUploaded).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toContain('uploaded');
  });

  it('blocks extra photos before upload and explains the limit', async () => {
    const uploadFile = vi.fn(okUpload);
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'unit', id: 'unit-1' }}
        max={1}
        uploadFile={uploadFile}
      />,
    );
    chooseFiles([imageFile('a.jpg'), imageFile('b.jpg')]);
    expect(screen.getByText('1 of 1 photos')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Photo limit reached.*1 of 1/);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
  });

  it('counts existing photos toward the counter', () => {
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'property', id: 'property-1' }}
        max={20}
        existingCount={19}
        uploadFile={okUpload}
      />,
    );
    expect(screen.getByText('19 of 20 photos')).toBeTruthy();
    chooseFiles([imageFile('a.jpg'), imageFile('b.jpg')]);
    expect(screen.getByText('20 of 20 photos')).toBeTruthy();
  });

  it('shows inline errors for a disallowed type and an oversize file without uploading them', async () => {
    const uploadFile = vi.fn(okUpload);
    render(
      <FileUploader
        kind="document"
        target={{ kind: 'property', id: 'property-1' }}
        uploadFile={uploadFile}
      />,
    );
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    chooseFiles([new File(['hello'], 'notes.txt', { type: 'text/plain' }), big]);
    expect(
      screen.getAllByRole('alert').some((el) => /not allowed/.test(el.textContent ?? '')),
    ).toBe(true);
    expect(screen.getAllByRole('alert').some((el) => /25 MB/.test(el.textContent ?? ''))).toBe(
      true,
    );
    expect(uploadFile).not.toHaveBeenCalled();
    // A document row shows a file-type icon instead of a thumbnail.
    expect(screen.getByText('TXT')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  it('supports retry after a failed upload and remove', async () => {
    let attempts = 0;
    const flaky: UploadFileFn = async (file) => {
      attempts += 1;
      if (attempts === 1) throw new Error('Network failed');
      return { id: 'doc-1', name: file.name };
    };
    const user = userEvent.setup();
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'property', id: 'property-1' }}
        max={10}
        uploadFile={flaky}
      />,
    );
    chooseFiles([imageFile('porch.jpg')]);
    await waitFor(() => expect(screen.getAllByText(/Network failed/).length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: 'Retry porch.jpg' }));
    await waitFor(() => expect(screen.getByText('Uploaded')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Remove porch.jpg' }));
    expect(screen.queryByText('porch.jpg')).toBeNull();
    expect(screen.getByText('0 of 10 photos')).toBeTruthy();
  });

  it('reorders photos and sets a cover photo, client-side', async () => {
    const onOrderChange = vi.fn();
    const onCoverChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'property', id: 'property-1' }}
        max={10}
        uploadFile={okUpload}
        onOrderChange={onOrderChange}
        onCoverChange={onCoverChange}
      />,
    );
    chooseFiles([imageFile('first.jpg'), imageFile('second.jpg')]);
    await waitFor(() => expect(screen.getAllByText('Uploaded')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Move first.jpg later' }));
    const names = [...document.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(names[0]).toContain('second.jpg');
    expect(names[1]).toContain('first.jpg');
    expect(onOrderChange).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Set second.jpg as cover' }));
    expect(screen.getAllByText(/Cover/).length).toBeGreaterThan(0);
    expect(onCoverChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'second.jpg', isCover: true }),
    );
  });

  it('accepts files dropped onto the drop zone', async () => {
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'property', id: 'property-1' }}
        max={5}
        uploadFile={okUpload}
      />,
    );
    const zone = screen.getByRole('group', { name: /drop files here/i });
    fireEvent.drop(zone, { dataTransfer: { files: [imageFile('dropped.jpg')] } });
    await waitFor(() => expect(screen.getByText('Uploaded')).toBeTruthy());
    expect(screen.getByText('1 of 5 photos')).toBeTruthy();
  });

  it('shows existing photos counted toward the limit and confirms removal through onRemove', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'unit', id: 'unit-1' }}
        max={10}
        initialFiles={[
          { id: 'p1', name: 'front.jpg', isCover: true },
          { id: 'p2', name: 'rear.jpg' },
        ]}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText('2 of 10 photos')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove rear.jpg'));
    await waitFor(() => expect(screen.getByText('1 of 10 photos')).toBeTruthy());
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ document: { id: 'p2', name: 'rear.jpg' } }),
    );
  });

  it('keeps the cover first when reordering', () => {
    const onOrderChange = vi.fn();
    render(
      <FileUploader
        kind="photo"
        target={{ kind: 'property', id: 'property-1' }}
        initialFiles={[
          { id: 'p1', name: 'a.jpg', isCover: true },
          { id: 'p2', name: 'b.jpg' },
          { id: 'p3', name: 'c.jpg' },
        ]}
        onOrderChange={onOrderChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Move c.jpg earlier'));
    const ids = onOrderChange.mock.calls[0][0].map(
      (i: { document: { id: string } }) => i.document.id,
    );
    expect(ids).toEqual(['p1', 'p3', 'p2']);
  });

  it('attaches selected files to a named form field instead of uploading', () => {
    const uploadFile = vi.fn();
    const { container } = render(
      <form>
        <FileUploader kind="photo" formField="photo" multiple={false} uploadFile={uploadFile} />
      </form>,
    );
    chooseFiles([imageFile('one.jpg'), imageFile('two.jpg')]);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(screen.getByText('one.jpg')).toBeTruthy();
    expect(screen.queryByText('two.jpg')).toBeNull();
    expect(container.querySelector('input[name="photo"]')).toBeTruthy();
  });
});
