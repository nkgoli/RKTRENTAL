import { readFile } from 'node:fs/promises';
import path from 'node:path';
import 'regenerator-runtime/runtime';
import fontkit, { type Font as SourceFont, type GlyphRun } from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  PDFName,
  PDFHexString,
  PDFOperator,
  PDFOperatorNames,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  setFillingColor,
  rgb,
} from 'pdf-lib';

export type SignedAgreementPdfInput = {
  id: string;
  leaseId: string;
  version: number;
  snapshot: unknown;
  snapshotHash: string;
  createdAt: Date;
  signedAt: Date | null;
  parties: {
    id: string;
    role: string;
    userId: string;
    expectedName: string;
    expectedEmail: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    consent: boolean | null;
    consentVersion: string | null;
    signedAt: Date | null;
    authenticatedSubjectId: string | null;
    authenticatedEmail: string | null;
    authenticationVersion: bigint | null;
    sessionIssuedAt: number | null;
  }[];
};

type Block = {
  text: string;
  heading?: boolean;
  title?: boolean;
  indent?: number;
  newPage?: boolean;
};
type FontSource = {
  filename: string;
  bytes: Uint8Array;
  source: SourceFont;
  characters: Set<number>;
};
type Font = FontSource & { font: PDFFont };
type Run = { text: string; font: Font; level: number; start: number; end: number };
const bidi = bidiFactory();
const fontFiles = [
  'NotoSans-Regular.ttf',
  'NotoSansSC-Regular.ttf',
  'NotoSansArabic-Regular.ttf',
  'NotoSansHebrew-Regular.ttf',
  'NotoSansDevanagari-Regular.ttf',
];
let fontSources: Promise<FontSource[]> | undefined;

function loadFonts(): Promise<FontSource[]> {
  fontSources ??= Promise.all(
    fontFiles.map(async (filename) => {
      const bytes = await readFile(path.join(process.cwd(), 'public', 'fonts', filename));
      const source = fontkit.create(bytes);
      return { filename, bytes, source, characters: new Set(source.characterSet) };
    }),
  ).catch((error: unknown) => {
    fontSources = undefined;
    throw error;
  });
  return fontSources;
}

/** Validate before committing a signature; adding a font also makes old failed archives retryable. */
export async function assertArchivableText(value: string): Promise<void> {
  const sources = await loadFonts();
  for (const character of safeText(value)) {
    if (character === '\n') continue;
    if (!sources.some((font) => font.characters.has(character.codePointAt(0)!)))
      throw new Error(
        `PDF font does not support U+${character.codePointAt(0)!.toString(16).toUpperCase()}; install an appropriate archival font.`,
      );
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const label = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());

/** Preserve every frozen value, including future fields, rather than selecting live lease data. */
function snapshotBlocks(value: unknown, name: string, depth = 0): Block[] {
  const indent = Math.min(depth, 4) * 12;
  if (Array.isArray(value)) {
    if (!value.length) return [{ text: `${name}: (empty list)`, indent }];
    return [
      { text: name, heading: true, indent },
      ...value.flatMap((item, index) => snapshotBlocks(item, `Item ${index + 1}`, depth + 1)),
    ];
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en'));
    if (!entries.length) return [{ text: `${name}: (empty object)`, indent }];
    return [
      { text: name, heading: true, indent },
      ...entries.flatMap(([key, item]) => snapshotBlocks(item, label(key), depth + 1)),
    ];
  }
  const text = value === null ? '(not specified)' : String(value);
  return [{ text: `${name}: ${text === '' ? '(empty text)' : text}`, indent }];
}

function signedAgreementBlocks(agreement: SignedAgreementPdfInput): Block[] {
  const snapshot = asRecord(agreement.snapshot);
  const frozenParties = Array.isArray(snapshot.parties) ? snapshot.parties.map(asRecord) : [];
  if (
    !agreement.signedAt ||
    !agreement.parties.length ||
    frozenParties.length !== agreement.parties.length ||
    frozenParties.some(
      (party) => !agreement.parties.some((signedParty) => signedParty.userId === party.userId),
    ) ||
    typeof snapshot.consentText !== 'string' ||
    !snapshot.consentText ||
    agreement.parties.some(
      (party) =>
        !party.signedAt ||
        !party.fullName ||
        !party.email ||
        !party.phone ||
        party.consent !== true ||
        !party.consentVersion ||
        party.consentVersion !== snapshot.consentVersion ||
        !party.authenticatedSubjectId ||
        !party.authenticatedEmail ||
        party.authenticationVersion === null ||
        party.sessionIssuedAt === null,
    )
  )
    throw new Error(
      'A final agreement PDF requires every frozen party and complete signature evidence.',
    );

  const property = asRecord(snapshot.property);
  const unit = asRecord(snapshot.unit);
  const terms = asRecord(snapshot.termsSnapshot);
  const wizard = asRecord(snapshot.wizard);
  const selectedText = asRecord(snapshot.selectedText);
  const blocks: Block[] = [
    { text: 'Signed lease agreement', heading: true, title: true },
    { text: `Agreement version ${agreement.version}` },
    { text: `Lease: ${agreement.leaseId}` },
    { text: `Agreement: ${agreement.id}` },
    { text: `Premises: ${String(property.name ?? '')} - Unit ${String(unit.number ?? '')}` },
    {
      text: [property.street, property.city, property.state, property.postalCode]
        .filter((part) => part !== null && part !== undefined && part !== '')
        .join(', '),
    },
    { text: `Term: ${String(snapshot.startDate ?? '')} to ${String(snapshot.endDate ?? '')}` },
    { text: `Issued for signing (UTC): ${agreement.createdAt.toISOString()}` },
    { text: `All required signatures recorded (UTC): ${agreement.signedAt.toISOString()}` },
    { text: `Frozen agreement SHA-256: ${agreement.snapshotHash}` },
    { text: 'Dates, rent and fees', heading: true },
    ...[
      'startDate',
      'endDate',
      'monthlyRent',
      'deposit',
      'lateFee',
      'graceDays',
      'rentDueDay',
      'prorateFirstMonth',
      'moveInFee',
      'petDeposit',
      'occupants',
    ].flatMap((key) =>
      snapshot[key] === undefined ? [] : snapshotBlocks(snapshot[key], label(key)),
    ),
    ...['returnedPaymentFee', 'keyFee'].flatMap((key) =>
      wizard[key] === undefined ? [] : snapshotBlocks(wizard[key], label(key)),
    ),
    { text: 'Agreed clauses, rules and disclosures', heading: true },
    ...(Array.isArray(terms.items)
      ? terms.items.flatMap((value, index) => {
          const term = asRecord(value);
          return [
            {
              text: `${index + 1}. ${String(term.title ?? term.section ?? 'Agreement term')}`,
              heading: true,
            },
            { text: String(term.body ?? '') },
          ];
        })
      : []),
    ...Object.entries(selectedText).flatMap(([key, value]) => snapshotBlocks(value, label(key))),
    ...['customClause', 'customRules'].flatMap((key) =>
      typeof wizard[key] === 'string' && wizard[key] ? snapshotBlocks(wizard[key], label(key)) : [],
    ),
    { text: 'Complete frozen review record', heading: true, newPage: true },
    {
      text: 'The following reproduces every field of the version reviewed by the signing parties, including supporting template and selection data. Source templates can contain unselected options: they are retained as review evidence, not added to the agreed terms. The resolved items and selections above identify the agreed clauses. The embedded agreement-snapshot.json retains the exact structured record.',
    },
    ...Object.entries(snapshot)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .flatMap(([key, value]) => snapshotBlocks(value, label(key))),
    { text: 'Electronic signatures and consent', heading: true, newPage: true },
    {
      text: 'Each entry below records an independently authenticated signature on this agreement version. These records document electronic consent; this PDF does not claim a certificate-based digital signature.',
    },
    { text: `Recorded consent version: ${String(snapshot.consentVersion)}` },
    { text: `Recorded consent text: ${snapshot.consentText}` },
  ];
  for (const [index, party] of agreement.parties.entries()) {
    blocks.push(
      { text: `${index + 1}. ${party.role} - ${party.fullName}`, heading: true },
      { text: `Typed signature: ${party.fullName}` },
      { text: `Email: ${party.email}` },
      { text: `Phone: ${party.phone}` },
      { text: `Signed at (UTC): ${party.signedAt!.toISOString()}` },
      { text: `Consent: accepted; version ${party.consentVersion}` },
      { text: `Required party: ${party.expectedName} <${party.expectedEmail}>` },
      { text: `Signature record: ${party.id}` },
      { text: `Authenticated account: ${party.authenticatedSubjectId}` },
      { text: `Authenticated email: ${party.authenticatedEmail}` },
      { text: `Authentication version: ${party.authenticationVersion}` },
      { text: `Session issued at (Unix seconds): ${party.sessionIssuedAt}` },
      { text: `Signed agreement: ${agreement.id}; version ${agreement.version}` },
      { text: `Signed snapshot SHA-256: ${agreement.snapshotHash}` },
    );
  }
  if (Array.isArray(snapshot.addendums) && snapshot.addendums.length)
    blocks.push(
      { text: 'Separate addendum files', heading: true },
      {
        text: 'The addendum names and content hashes in the frozen agreement identify separate original files included in this signed agreement. Their file bytes are preserved separately in Documents. This PDF does not add or assert separate signatures within those originals.',
      },
    );
  return blocks;
}

function safeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
}

function runsFor(text: string, fonts: Font[]): Run[] {
  const runs: Run[] = [];
  const embedding = bidi.getEmbeddingLevels(text, 'ltr');
  const mirrored = bidi.getMirroredCharactersMap(text, embedding);
  let offset = 0;
  for (const character of text) {
    const rendered = mirrored.get(offset) ?? character;
    const point = rendered.codePointAt(0)!;
    const previous = runs.at(-1);
    const level = embedding.levels[offset];
    // Keep common spaces and punctuation with their script when the bidi level agrees.
    const font =
      previous?.level === level &&
      /^[\p{P}\p{Z}]$/u.test(rendered) &&
      previous.font.characters.has(point)
        ? previous.font
        : fonts.find((candidate) => candidate.characters.has(point));
    // Missing characters must leave archival recoverable, never silently replace a legal name.
    if (!font)
      throw new Error(
        `PDF font does not support U+${point.toString(16).toUpperCase()}; install an appropriate archival font.`,
      );
    if (previous?.font === font && previous.level === level) {
      previous.text += rendered;
      previous.end = offset + character.length - 1;
    } else
      runs.push({ text: rendered, font, level, start: offset, end: offset + character.length - 1 });
    offset += character.length;
  }
  const visual = bidi.getReorderedIndices(text, embedding);
  const positions = new Map(visual.map((logical, index) => [logical, index]));
  return runs.sort(
    (a, b) =>
      Math.min(positions.get(a.start)!, positions.get(a.end)!) -
      Math.min(positions.get(b.start)!, positions.get(b.end)!),
  );
}

function shape(run: Run): GlyphRun {
  // Fontkit supports direction in its runtime API; the bundled declarations omit these arguments.
  const layout = run.font.source.layout as (
    text: string,
    features: undefined,
    script: undefined,
    language: undefined,
    direction: 'ltr' | 'rtl',
  ) => GlyphRun;
  return layout.call(
    run.font.source,
    run.text,
    undefined,
    undefined,
    undefined,
    run.level % 2 ? 'rtl' : 'ltr',
  );
}

const textWidth = (text: string, size: number, fonts: Font[]) =>
  runsFor(text, fonts).reduce(
    (total, run) => total + (shape(run).advanceWidth * size) / run.font.source.unitsPerEm,
    0,
  );

/** Wrap by measured glyph widths, splitting long identifiers without dropping any characters. */
function wrapMeasured(text: string, width: number, size: number, fonts: Font[]): string[] {
  return safeText(text)
    .split('\n')
    .flatMap((paragraph) => {
      const lines: string[] = [];
      let line = '';
      for (const token of paragraph.match(/\S+|\s+/gu) ?? []) {
        if (textWidth(line + token, size, fonts) <= width) {
          line += token;
          continue;
        }
        if (line) {
          lines.push(line);
          line = '';
        }
        for (const character of token) {
          if (line && textWidth(line + character, size, fonts) > width) {
            lines.push(line);
            line = '';
          }
          line += character;
        }
      }
      if (line || !lines.length) lines.push(line);
      return lines;
    });
}

/** Final archival path: uses only the immutable snapshot and recorded individual signatures. */
export async function buildSignedAgreementPdf(
  agreement: SignedAgreementPdfInput,
): Promise<Uint8Array> {
  const blocks = signedAgreementBlocks(agreement);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Signed lease agreement - version ${agreement.version}`);
  pdf.setAuthor('RocketRental');
  pdf.setCreator('RocketRental signed agreement archive');
  pdf.setCreationDate(agreement.signedAt!);
  pdf.setModificationDate(agreement.signedAt!);
  const fonts: Font[] = [];
  const sources = await loadFonts();
  const needed = new Set([sources[0]]);
  for (const block of blocks) {
    await assertArchivableText(block.text);
    for (const character of safeText(block.text)) {
      const source = sources.find((candidate) =>
        candidate.characters.has(character.codePointAt(0)!),
      );
      if (source) needed.add(source);
    }
  }
  // Full static fonts preserve composite glyphs and permit exact shaped-glyph positioning.
  for (const source of sources.filter((candidate) => needed.has(candidate)))
    fonts.push({ ...source, font: await pdf.embedFont(source.bytes, { subset: false }) });

  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  const bottom = 54;
  let page: PDFPage;
  let y = 0;
  const pageFonts = new WeakMap<PDFPage, Map<PDFFont, PDFName>>();
  const drawLine = (text: string, x: number, at: number, size: number, muted = false) => {
    // ActualText retains logical Unicode ordering for assistive readers and copied text.
    page.pushOperators(
      PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
        PDFName.of('Span'),
        pdf.context.obj({ ActualText: PDFHexString.fromText(text) }).toString(),
      ]),
    );
    for (const run of runsFor(text, fonts)) {
      let names = pageFonts.get(page);
      if (!names) {
        names = new Map();
        pageFonts.set(page, names);
      }
      let name = names.get(run.font.font);
      if (!name) {
        name = page.node.newFontDictionary(run.font.font.name, run.font.font.ref);
        names.set(run.font.font, name);
      }
      const shaped = shape(run);
      const scale = size / run.font.source.unitsPerEm;
      page.pushOperators(
        beginText(),
        setFontAndSize(name, size),
        setFillingColor(muted ? rgb(0.34, 0.4, 0.49) : rgb(0.09, 0.14, 0.23)),
      );
      for (const [index, glyph] of shaped.glyphs.entries()) {
        const position = shaped.positions[index];
        page.pushOperators(
          setTextMatrix(1, 0, 0, 1, x + position.xOffset * scale, at + position.yOffset * scale),
          showText(PDFHexString.of(glyph.id.toString(16).padStart(4, '0').toUpperCase())),
        );
        x += position.xAdvance * scale;
      }
      page.pushOperators(endText());
    }
    page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
  };
  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    drawLine('ROCKETRENTAL  /  LEASE RECORD', margin, pageHeight - 32, 8, true);
    page.drawLine({
      start: { x: margin, y: pageHeight - 41 },
      end: { x: pageWidth - margin, y: pageHeight - 41 },
      thickness: 0.5,
      color: rgb(0.8, 0.83, 0.88),
    });
    y = pageHeight - 66;
  };
  addPage();
  for (const block of blocks) {
    const size = block.title ? 18 : block.heading ? 11.5 : 9.5;
    const leading = block.title ? 24 : block.heading ? 17 : 14;
    const indent = block.indent ?? 0;
    const lines = wrapMeasured(block.text, pageWidth - 2 * margin - indent, size, fonts);
    if (block.newPage || y - leading * (block.heading ? Math.min(lines.length + 2, 5) : 1) < bottom)
      addPage();
    if (block.heading) y -= 8;
    for (const line of lines) {
      if (y < bottom) addPage();
      drawLine(line, margin + indent, y, size);
      y -= leading;
    }
    y -= block.heading ? 3 : 4;
  }
  for (const [index, currentPage] of pdf.getPages().entries()) {
    page = currentPage;
    drawLine(
      `Agreement v${agreement.version}  |  ${agreement.snapshotHash.slice(0, 16)}`,
      margin,
      28,
      8,
      true,
    );
    const count = `${index + 1} / ${pdf.getPageCount()}`;
    drawLine(count, pageWidth - margin - textWidth(count, 8, fonts), 28, 8, true);
  }
  await pdf.attach(
    new TextEncoder().encode(JSON.stringify(agreement.snapshot, null, 2)),
    'agreement-snapshot.json',
    {
      mimeType: 'application/json',
      description:
        'Exact immutable agreement snapshot reviewed and signed by all required parties.',
      creationDate: agreement.createdAt,
      modificationDate: agreement.signedAt!,
    },
  );
  await pdf.attach(
    new TextEncoder().encode(
      JSON.stringify(
        {
          agreementId: agreement.id,
          leaseId: agreement.leaseId,
          version: agreement.version,
          snapshotHash: agreement.snapshotHash,
          signedAt: agreement.signedAt,
          parties: agreement.parties,
        },
        (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value),
        2,
      ),
    ),
    'signature-evidence.json',
    {
      mimeType: 'application/json',
      description:
        'Exact individual signature and authentication records; Unicode names remain in logical order.',
      creationDate: agreement.signedAt!,
      modificationDate: agreement.signedAt!,
    },
  );
  return pdf.save();
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(line: string, width = 88): string[] {
  const words = line.split(/\s+/);
  const result: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > width) {
      result.push(current);
      current = '';
    }
    if (word.length > width) {
      if (current) result.push(current);
      for (let at = 0; at < word.length; at += width) result.push(word.slice(at, at + width));
      current = '';
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) result.push(current);
  return result.length ? result : [''];
}

/** Paginate every term so long clauses remain in the signed copy. */
export function buildLeasePdf(lines: string[]): Uint8Array {
  const safe = lines.flatMap((line) => wrapLine(line)).map(escapePdfText);
  const pageSize = 38;
  const pages = Array.from({ length: Math.max(1, Math.ceil(safe.length / pageSize)) }, (_, i) =>
    safe.slice(i * pageSize, (i + 1) * pageSize),
  );
  const fontId = 3 + pages.length * 2;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  const encoder = new TextEncoder();
  pages.forEach((page, pageIndex) => {
    const contentId = 4 + pageIndex * 2;
    const content =
      `BT /F1 16 Tf 56 780 Td (RocketRental lease agreement${pageIndex ? ' - continued' : ''}) Tj ET\n` +
      page.map((line, i) => `BT /F1 10 Tf 56 ${744 - i * 18} Td (${line}) Tj ET`).join('\n') +
      '\n';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    objects.push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++)
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return encoder.encode(pdf);
}

export function signedLeaseLines(input: {
  leaseId: string;
  unitLabel: string;
  tenantNames: string[];
  term: string;
  monthlyRent: string;
  deposit: string;
  clauses: string[];
  templateLine?: string;
  signedAt: Date;
}): string[] {
  return [
    `Lease: ${input.leaseId}`,
    `Premises: ${input.unitLabel}`,
    `Tenants: ${input.tenantNames.join(', ')}`,
    `Term: ${input.term}`,
    `Monthly rent: $${input.monthlyRent} - Deposit: $${input.deposit}`,
    ...(input.templateLine ? [input.templateLine] : []),
    ...input.clauses.map((c) => `Clause: ${c}`),
    'Lease summary only. Individual signature evidence is not included in this legacy summary.',
    `Supplied record date: ${input.signedAt.toISOString()}`,
  ];
}
