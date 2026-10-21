// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AgreementContent } from '@/components/lease-signing/AgreementContent';
import { SigningPanel, type SigningView } from '@/components/lease-signing/SigningPanel';
import type { EsignEnvelope } from '@/lib/esign/types';

const consentText = 'I have reviewed this agreement and consent to sign it electronically.';
const signedAt = '2035-02-03T12:00:00.000Z';
const snapshot = {
  property: { name: 'Synthetic House', street: '10 Test Street', city: 'Testville', state: 'CA' },
  unit: { number: '2' },
  lessor: { name: 'Synthetic Lessor', signingName: 'Owner Account', email: 'owner@example.test' },
  parties: [
    { role: 'OWNER', expectedName: 'Owner Account' },
    { role: 'TENANT', expectedName: 'Tenant One' },
    { role: 'TENANT', expectedName: 'Tenant Two' },
  ],
  startDate: '2035-03-01T00:00:00.000Z',
  endDate: '2036-02-29T00:00:00.000Z',
  monthlyRent: '1690.00',
  deposit: '1000.00',
  lateFee: '75.00',
  graceDays: 5,
  rentDueDay: 1,
  moveInFee: '50.00',
  petDeposit: '200.00',
  prorateFirstMonth: true,
  occupants: 'Two residents',
  wizard: {
    leaseType: 'fixed',
    renewalNoticeDays: 60,
    returnedPaymentFee: '35.00',
    keyFee: '25.00',
    tenantUtilities: ['Electricity', 'Gas'],
    lessorAddress: '20 Mailing Street',
    lessorPhone: '415-555-0199',
    customClause: 'The agreed custom clause is retained exactly.',
    customRules: 'The agreed custom rule is retained exactly.',
  },
  termsSnapshot: {
    items: [
      { title: 'Resolved agreement clause', body: 'The resident may use parking space 12.' },
      { title: 'Excluded clause', body: 'This was not selected.', included: false },
    ],
    template: {
      items: [{ title: 'Unselected source option', body: 'Never part of the agreement.' }],
    },
  },
  selectedText: {
    clauses: [{ label: 'Legacy clause', description: 'The complete legacy clause wording.' }],
    options: [{ label: 'Selected option', description: 'The complete option wording.' }],
    rules: [{ label: 'Selected rule', description: 'The complete rule wording.' }],
    disclosures: [
      { label: 'Selected disclosure', description: 'The complete disclosure wording.' },
    ],
  },
  addendums: [
    { documentId: 'pet-addendum', name: 'Pet addendum.pdf', mimeType: 'application/pdf' },
    { documentId: 'parking-addendum', name: 'Parking addendum.txt', mimeType: 'text/plain' },
  ],
};

function agreement(overrides: Partial<SigningView> = {}): SigningView {
  return {
    id: 'agreement-v1',
    provider: 'internal',
    leaseId: 'lease-one',
    version: 1,
    snapshotHash: 'a'.repeat(64),
    status: 'SENT',
    archiveStatus: 'AWAITING_SIGNATURES',
    sentAt: '2035-02-01T00:00:00.000Z',
    signedAt: null,
    archiveDocumentId: null,
    signers: [
      {
        id: 'owner-party',
        role: 'OWNER',
        name: 'Owner Account',
        email: 'owner@example.test',
        signedAt: null,
      },
      {
        id: 'tenant-one',
        role: 'TENANT',
        name: 'Tenant One',
        email: 'tenant-one@example.test',
        signedAt: null,
      },
      {
        id: 'tenant-two',
        role: 'TENANT',
        name: 'Tenant Two',
        email: 'tenant-two@example.test',
        signedAt: null,
      },
    ],
    snapshot,
    myPartyId: 'owner-party',
    consentText,
    consentVersion: 'lease-esign-v1',
    ...overrides,
  };
}

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open(view = agreement()) {
  fetchMock.mockResolvedValueOnce(response(view));
  render(<SigningPanel leaseId="lease-one" documentsHref="/lease#documents" />);
  await screen.findByRole('heading', { name: 'Full agreement' });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Check status' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
}

function fillSignature() {
  fireEvent.change(screen.getByRole('textbox', { name: /^Full name/ }), {
    target: { value: 'Owner Legal Name' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /^Phone/ }), {
    target: { value: '+1 (415) 555-0123' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: consentText }));
}

describe('individual signing panel', () => {
  it('lets a manager observer review all parties without offering a signature form', async () => {
    await open(agreement({ myPartyId: null }));
    expect(screen.queryByRole('form', { name: 'Your electronic signature' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign this agreement' })).toBeNull();
    expect(
      screen.getByText(/only the designated owner \/ lessor and tenants can sign/),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('list', { name: 'Designated signing parties' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(3);
    expect(screen.getAllByText('Awaiting signature')).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires deliberate name, phone and consent and associates inline errors with controls', async () => {
    await open();
    const form = screen.getByRole('form', { name: 'Your electronic signature' });
    const name = screen.getByRole('textbox', { name: /^Full name/ }) as HTMLInputElement;
    const phone = screen.getByRole('textbox', { name: /^Phone/ }) as HTMLInputElement;
    const consent = screen.getByRole('checkbox', { name: consentText }) as HTMLInputElement;
    expect(name.value).toBe('');
    expect(phone.value).toBe('');
    expect(consent.checked).toBe(false);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain('Check the highlighted fields');
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    for (const control of [name, phone, consent]) {
      expect(control.getAttribute('aria-invalid')).toBe('true');
      expect(
        document.getElementById(control.getAttribute('aria-describedby')!)?.textContent,
      ).toBeTruthy();
    }
    fireEvent.change(name, { target: { value: '12345' } });
    fireEvent.change(phone, { target: { value: 'not a phone' } });
    fireEvent.click(consent);
    fireEvent.submit(form);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(consent.getAttribute('aria-invalid')).toBe('false');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(name, { target: { value: 'Owner Legal Name' } });
    fireEvent.change(phone, { target: { value: '4155550123' } });
    fireEvent.click(consent);
    fireEvent.submit(form);
    expect(name.getAttribute('aria-invalid')).toBe('false');
    expect(phone.getAttribute('aria-invalid')).toBe('false');
    expect(consent.getAttribute('aria-invalid')).toBe('true');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('posts the authenticated party email and preserves the agreement when POST returns only an envelope', async () => {
    const initial = agreement();
    const signed = {
      ...initial,
      status: 'PARTIALLY_SIGNED' as const,
      signers: initial.signers.map((party) =>
        party.id === initial.myPartyId ? { ...party, signedAt } : party,
      ),
    };
    await open(initial);
    const email = screen.getByRole('textbox', { name: /^Email/ }) as HTMLInputElement;
    expect(email.readOnly).toBe(true);
    expect(email.value).toBe('owner@example.test');
    // A DOM value cannot change the server-designated party used to build the request.
    fireEvent.change(email, { target: { value: 'tenant-one@example.test' } });
    fillSignature();
    const {
      snapshot: _snapshot,
      myPartyId: _party,
      consentText: _text,
      consentVersion: _version,
      ...envelope
    } = signed;
    void [_snapshot, _party, _text, _version];
    fetchMock.mockResolvedValueOnce(response(envelope satisfies EsignEnvelope));
    let finishRefresh!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishRefresh = resolve;
      }),
    );
    fireEvent.submit(screen.getByRole('form', { name: 'Your electronic signature' }));
    await screen.findByText(/You have already signed this agreement/);
    expect(screen.getByText('The resident may use parking space 12.')).toBeTruthy();
    expect(screen.getByText('Owner Account (you)')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Download Pet addendum.pdf' }).getAttribute('href'),
    ).toBe('/api/files/pet-addendum/download');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, request] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/leases/lease-one/signing');
    expect(request?.method).toBe('POST');
    expect(JSON.parse(String(request?.body))).toEqual({
      agreementId: 'agreement-v1',
      snapshotHash: 'a'.repeat(64),
      fullName: 'Owner Legal Name',
      email: 'owner@example.test',
      phone: '+1 (415) 555-0123',
      consent: true,
      consentVersion: 'lease-esign-v1',
    });
    finishRefresh(response(signed));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Check status' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.queryByRole('form', { name: 'Your electronic signature' })).toBeNull();
    expect(screen.getAllByText('Awaiting signature')).toHaveLength(2);
  });

  it('restores an already recorded signature after reload without permitting replacement', async () => {
    const view = agreement();
    view.status = 'PARTIALLY_SIGNED';
    view.signers[0].signedAt = signedAt;
    await open(view);
    expect(screen.getByText(/You have already signed this agreement/)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /^Full name/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign this agreement' })).toBeNull();
    expect(screen.getAllByText('Awaiting signature')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Download Signed lease agreement.pdf' })).toBeNull();
  });

  it('disables stale signing after a 409 and requires renewed consent after loading the current version', async () => {
    await open();
    fillSignature();
    fetchMock.mockResolvedValueOnce(
      response({ error: 'Review the current agreement before signing.' }, 409),
    );
    fireEvent.submit(screen.getByRole('form', { name: 'Your electronic signature' }));
    await screen.findByText('Review the current agreement before signing.');
    const submit = screen.getByRole('button', { name: 'Sign this agreement' }) as HTMLButtonElement;
    const consent = screen.getByRole('checkbox', { name: consentText }) as HTMLInputElement;
    expect(submit.disabled).toBe(true);
    expect(consent.disabled).toBe(true);
    expect(consent.checked).toBe(false);
    expect((screen.getByRole('textbox', { name: /^Full name/ }) as HTMLInputElement).disabled).toBe(
      true,
    );
    fetchMock.mockResolvedValueOnce(
      response(agreement({ id: 'agreement-v2', version: 2, snapshotHash: 'b'.repeat(64) })),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Check status' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
    await screen.findByText('Agreement version 2');
    expect(submit.disabled).toBe(false);
    expect(consent.disabled).toBe(false);
    expect(consent.checked).toBe(false);
    fireEvent.submit(screen.getByRole('form', { name: 'Your electronic signature' }));
    expect(screen.getByText('Confirm that you agree to sign electronically.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears checked consent when a status refresh discovers a different agreement version', async () => {
    await open();
    fillSignature();
    fetchMock.mockResolvedValueOnce(
      response(agreement({ id: 'agreement-v2', version: 2, snapshotHash: 'b'.repeat(64) })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
    await screen.findByText('Agreement version 2');
    expect((screen.getByRole('checkbox', { name: consentText }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['PDF_PENDING', /Preparing your documents/, 'The final PDF is processing.'],
    ['PDF_FAILED', /Document needs another attempt/, 'The document could not be stored.'],
  ] as const)(
    'distinguishes all-signed %s from an available final PDF',
    async (archiveStatus, title, message) => {
      const initial = agreement();
      await open(
        agreement({
          status: 'SIGNED',
          signedAt,
          archiveStatus,
          signers: initial.signers.map((party) => ({ ...party, signedAt })),
          ...(archiveStatus === 'PDF_FAILED'
            ? { archiveNextAttemptAt: '2035-02-03T12:01:00.000Z' }
            : {}),
        }),
      );
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      expect(
        screen.getByText('Your signatures are saved. No one needs to sign again.'),
      ).toBeTruthy();
      expect(screen.getByText((value) => value.startsWith(String(message)))).toBeTruthy();
      expect(
        screen.queryByRole('link', { name: 'Download Signed lease agreement.pdf' }),
      ).toBeNull();
      expect(screen.queryByRole('button', { name: 'Sign this agreement' })).toBeNull();
      if (archiveStatus === 'PDF_FAILED') expect(screen.getByText(/Next retry after/)).toBeTruthy();
    },
  );

  it('offers the archived final PDF and keeps each addendum as a separate file', async () => {
    const initial = agreement();
    await open(
      agreement({
        status: 'SIGNED',
        signedAt,
        archiveStatus: 'ARCHIVED',
        archiveDocumentId: 'final-lease',
        signers: initial.signers.map((party) => ({ ...party, signedAt })),
      }),
    );
    expect(screen.getByRole('heading', { name: /All signed.*Documents ready/ })).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Download Signed lease agreement.pdf' })
        .getAttribute('href'),
    ).toBe('/api/files/final-lease/download');
    expect(
      screen
        .getByRole('link', { name: 'Preview Signed lease agreement.pdf (opens in a new tab)' })
        .getAttribute('href'),
    ).toBe('/api/files/final-lease/preview');
    expect(
      screen.getByRole('link', { name: 'Download Pet addendum.pdf' }).getAttribute('href'),
    ).toBe('/api/files/pet-addendum/download');
    expect(
      screen.getByRole('link', { name: 'Download Parking addendum.txt' }).getAttribute('href'),
    ).toBe('/api/files/parking-addendum/download');
    expect(screen.queryByText(/The final PDF is processing/)).toBeNull();
  });
});

it('renders complete frozen operative wording and separate supported file previews', () => {
  render(<AgreementContent snapshot={snapshot} />);
  for (const value of [
    'The resident may use parking space 12.',
    'The complete legacy clause wording.',
    'The complete option wording.',
    'The complete rule wording.',
    'The complete disclosure wording.',
    'The agreed custom clause is retained exactly.',
    'The agreed custom rule is retained exactly.',
    'Electricity, Gas',
    '20 Mailing Street',
    '415-555-0199',
    '$35.00',
    '$25.00',
  ])
    expect(screen.getByText(value)).toBeTruthy();
  expect(screen.queryByText('This was not selected.')).toBeNull();
  expect(screen.queryByText('Never part of the agreement.')).toBeNull();
  expect(
    screen
      .getByRole('link', { name: 'Preview Pet addendum.pdf (opens in a new tab)' })
      .getAttribute('target'),
  ).toBe('_blank');
  expect(screen.queryByRole('link', { name: /Preview Parking addendum/ })).toBeNull();
  expect(screen.getAllByRole('link', { name: /^Download/ })).toHaveLength(2);
});
