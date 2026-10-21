import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import {
  buildSignedAgreementPdf,
  assertArchivableText,
  signedLeaseLines,
  type SignedAgreementPdfInput,
} from '@/lib/esign/pdf';

function snapshotHash(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(canonical).join(',')}]`;
    if (item && typeof item === 'object')
      return `{${Object.entries(item)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, field]) => `${JSON.stringify(key)}:${canonical(field)}`)
        .join(',')}}`;
    return JSON.stringify(item);
  };
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function example(): SignedAgreementPdfInput {
  const people = [
    { fullName: 'Zoë García', role: 'OWNER', email: 'owner@example.test' },
    { fullName: '李明', role: 'TENANT', email: 'tenant@example.test' },
    { fullName: 'Олена Коваль', role: 'TENANT', email: 'cotenant@example.test' },
  ];
  const parties = people.map((person, index) => ({
    ...person,
    id: `party-${index}`,
    userId: `user-${index}`,
    expectedName: person.fullName,
    expectedEmail: person.email,
    phone: `+1 415 555 010${index}`,
    consent: true,
    consentVersion: 'lease-esign-v1',
    signedAt: new Date(`2026-10-20T10:0${index}:00.000Z`),
    authenticatedSubjectId: `user-${index}`,
    authenticatedEmail: person.email,
    authenticationVersion: 1792400000000n,
    sessionIssuedAt: 1792400000,
  }));
  const agreement: SignedAgreementPdfInput = {
    id: 'synthetic-agreement-3',
    leaseId: 'synthetic-renewal-lease',
    version: 3,
    createdAt: new Date('2026-10-19T09:00:00.000Z'),
    signedAt: parties[2].signedAt,
    snapshotHash: 'a'.repeat(64),
    parties,
    snapshot: {
      schemaVersion: 1,
      leaseId: 'synthetic-renewal-lease',
      renewsLeaseId: 'synthetic-prior-lease',
      property: {
        name: 'Cedar Court',
        street: '101 Example Lane',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94102',
      },
      unit: { id: 'synthetic-unit', number: '4B' },
      lessor: { name: 'Zoë García', email: 'owner@example.test' },
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2027-10-31T00:00:00.000Z',
      monthlyRent: '2450.00',
      deposit: '2450.00',
      lateFee: '75.00',
      graceDays: 5,
      rentDueDay: 1,
      prorateFirstMonth: false,
      moveInFee: '125.00',
      petDeposit: '300.00',
      occupants: 'Three residents',
      templateId: 'standard-residential',
      templateVersion: 2,
      termsSnapshot: {
        items: [
          {
            id: 'custom-residential',
            section: 'CLAUSE',
            title: 'Custom agreement',
            body: 'All agreed terms remain readable. '.repeat(320) + 'FINAL AGREED SENTENCE.',
          },
        ],
        template: {
          items: [
            {
              title: 'Unused option',
              body: 'UNSELECTED TEMPLATE OPTION',
              includeWhen: 'PETS_ALLOWED',
            },
          ],
        },
      },
      wizard: {
        customRules: 'Quiet hours after 10 pm.\nKeep common areas accessible.',
        keyFee: '20.00',
        returnedPaymentFee: '35.00',
      },
      selectedText: {
        clauses: [
          {
            id: 'residential-use',
            label: 'Residential use only',
            description: 'The unit may be used only as a private residence.',
          },
        ],
      },
      parties: parties.map((party) => ({
        userId: party.userId,
        role: party.role,
        expectedName: party.expectedName,
        expectedEmail: party.expectedEmail,
      })),
      consentVersion: 'lease-esign-v1',
      consentText:
        'I have reviewed this agreement and consent to sign it electronically. My typed full name is my signature on this agreement version.',
      addendums: [
        {
          documentId: 'original-pet-addendum',
          name: 'Pet agreement - approved cat.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          sha256: 'b'.repeat(64),
        },
      ],
    },
  };
  agreement.snapshotHash = snapshotHash(agreement.snapshot);
  return agreement;
}

function evidence(name: string, bytes: Uint8Array) {
  if (process.env.WRITE_PDF_EVIDENCE === '1') {
    mkdirSync('docs/leases/pdf-evidence', { recursive: true });
    writeFileSync(`docs/leases/pdf-evidence/${name}.pdf`, bytes);
  }
}

/** Read logical Unicode from the marked text that encloses each PDF drawing line. */
function extractedText(pdf: PDFDocument): string {
  return pdf
    .getPages()
    .map((page) => {
      const content = page.node.Contents();
      const streams = content instanceof PDFArray ? content.asArray() : [content!];
      return streams
        .map((reference) => {
          const stream = pdf.context.lookup(reference) as PDFRawStream;
          const drawing = new TextDecoder().decode(decodePDFRawStream(stream).decode());
          return [...drawing.matchAll(/\/ActualText <FEFF([0-9A-F]+)>/g)]
            .map((match) =>
              String.fromCharCode(
                ...(match[1].match(/.{4}/g) ?? []).map((unit) => parseInt(unit, 16)),
              ),
            )
            .join('\n');
        })
        .join('\n');
    })
    .join('\n');
}

describe('immutable signed agreement PDF', () => {
  it('renders full long terms, all actual signatures and Unicode names across readable pages', async () => {
    const agreement = example();
    const bytes = await buildSignedAgreementPdf(agreement);
    evidence('synthetic-long-signed-agreement', bytes);
    const pdf = await PDFDocument.load(bytes);
    const text = extractedText(pdf);
    expect(pdf.getPageCount()).toBeGreaterThan(4);
    for (const phrase of [
      'Agreement version 3',
      'FINAL AGREED SENTENCE.',
      '2450.00',
      '75.00',
      '125.00',
      '300.00',
      '20.00',
      '35.00',
      '2027-10-31',
      'Residential use only',
      'synthetic-prior-lease',
      'Zoë García',
      '李明',
      'Олена Коваль',
      'owner@example.test',
      'tenant@example.test',
      'cotenant@example.test',
      '+1 415 555 0102',
      '2026-10-20T10:02:00.000Z',
      '1792400000000',
      '1792400000',
      'consent to sign it electronically',
      'Pet agreement - approved cat.pdf',
      'Separate addendum files',
    ])
      expect(text).toContain(phrase);
    expect(text).not.toContain('mock');
    expect(text).not.toContain(' - signed');
    expect(text.indexOf('FINAL AGREED SENTENCE.')).toBeLessThan(
      text.indexOf('Complete frozen review record'),
    );
    expect(text.indexOf('UNSELECTED TEMPLATE OPTION')).toBeGreaterThan(
      text.indexOf('Complete frozen review record'),
    );
    // The complete snapshot is also recoverable without text reflow or label transformation.
    const embedded = pdf.catalog
      .lookup(PDFName.of('Names'), PDFDict)
      .lookup(PDFName.of('EmbeddedFiles'), PDFDict)
      .lookup(PDFName.of('Names'), PDFArray);
    const attachment = pdf.context
      .lookup(embedded.get(1), PDFDict)
      .lookup(PDFName.of('EF'), PDFDict)
      .lookup(PDFName.of('F')) as PDFRawStream;
    expect(JSON.parse(new TextDecoder().decode(decodePDFRawStream(attachment).decode()))).toEqual(
      agreement.snapshot,
    );
    for (const page of pdf.getPages()) expect(page.getSize()).toEqual({ width: 612, height: 792 });
  }, 30000);

  it('produces identical bytes on retry and preserves separate renewal/addendum references', async () => {
    const agreement = example();
    const snapshot = agreement.snapshot as Record<string, unknown>;
    snapshot.termsSnapshot = {
      items: [
        { title: 'Renewal terms', body: 'The renewal retains the agreed residential terms.' },
      ],
    };
    agreement.snapshotHash = snapshotHash(agreement.snapshot);
    const first = await buildSignedAgreementPdf(agreement);
    const retry = await buildSignedAgreementPdf(agreement);
    expect(createHash('sha256').update(first).digest('hex')).toBe(
      createHash('sha256').update(retry).digest('hex'),
    );
    const text = extractedText(await PDFDocument.load(first));
    expect(text).toContain('synthetic-prior-lease');
    expect(text).toContain('original-pet-addendum');
    expect(text).toContain('Their file bytes are preserved separately');
    evidence('synthetic-renewal-with-addendum-reference', first);
  }, 30000);

  it('refuses partial signatures or a missing member of the frozen signer roster', async () => {
    const partial = example();
    partial.parties[1].signedAt = null;
    await expect(buildSignedAgreementPdf(partial)).rejects.toThrow('complete signature evidence');
    const missing = example();
    missing.parties.pop();
    await expect(buildSignedAgreementPdf(missing)).rejects.toThrow('complete signature evidence');
  });

  it('preflights and renders Arabic, Hebrew and Devanagari actual signer names', async () => {
    const names = ['محمد أحمد', 'אביגיל', 'अर्जुन'];
    for (const name of names) await expect(assertArchivableText(name)).resolves.toBeUndefined();
    await expect(assertArchivableText('unsupported \u{1F680}')).rejects.toThrow('U+1F680');
    const agreement = example();
    const snapshot = agreement.snapshot as Record<string, unknown>;
    snapshot.termsSnapshot = {
      items: [
        {
          title: 'Agreed terms',
          body: 'The terms were reviewed and signed by each designated party.',
        },
      ],
    };
    agreement.parties.forEach((party, index) => {
      party.fullName = names[index];
      party.expectedName = names[index];
    });
    snapshot.parties = agreement.parties.map((party) => ({
      userId: party.userId,
      role: party.role,
      expectedName: party.expectedName,
      expectedEmail: party.expectedEmail,
    }));
    agreement.snapshotHash = snapshotHash(snapshot);
    const bytes = await buildSignedAgreementPdf(agreement);
    const text = extractedText(await PDFDocument.load(bytes));
    for (const name of names) expect(text).toContain(name);
    evidence('synthetic-multiscript-signatures', bytes);
  }, 30000);

  it('refuses missing consent and authentication audit fields', async () => {
    for (const field of [
      'consent',
      'consentVersion',
      'authenticatedSubjectId',
      'authenticationVersion',
    ] as const) {
      const agreement = example();
      agreement.parties[0][field] = null;
      await expect(buildSignedAgreementPdf(agreement)).rejects.toThrow(
        'complete signature evidence',
      );
    }
  });

  it('fails explicitly for unavailable glyphs instead of archiving corrupted names', async () => {
    const agreement = example();
    agreement.parties[0].fullName = 'Name \u{1F680}';
    await expect(buildSignedAgreementPdf(agreement)).rejects.toThrow('U+1F680');
  }, 30000);

  it('does not fabricate evidence in legacy summary lines', () => {
    const lines = signedLeaseLines({
      leaseId: 'legacy',
      unitLabel: '4B',
      tenantNames: ['Alex'],
      term: '2026',
      monthlyRent: '1000',
      deposit: '1000',
      clauses: [],
      signedAt: new Date('2026-10-20'),
    }).join('\n');
    expect(lines).toContain('signature evidence is not included');
    expect(lines).not.toContain('mock');
    expect(lines).not.toContain('Signer: Alex - signed');
  });
});
