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
  const pages = Array.from({ length: Math.max(1, Math.ceil(safe.length / pageSize)) }, (_, i) => safe.slice(i * pageSize, (i + 1) * pageSize));
  const fontId = 3 + pages.length * 2;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  const encoder = new TextEncoder();
  pages.forEach((page, pageIndex) => {
    const contentId = 4 + pageIndex * 2;
    const content = `BT /F1 16 Tf 56 780 Td (RocketRental lease agreement${pageIndex ? ' - continued' : ''}) Tj ET\n` +
      page.map((line, i) => `BT /F1 10 Tf 56 ${744 - i * 18} Td (${line}) Tj ET`).join('\n') + '\n';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`);
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
    'Signed electronically via RocketRental (mock e-signature).',
    `Signed at: ${input.signedAt.toISOString()}`,
    ...input.tenantNames.map((n) => `Signer: ${n} - signed`),
  ];
}
