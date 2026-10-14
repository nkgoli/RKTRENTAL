function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Smallest valid single-page PDF carrying the lease summary and signature lines. */
export function buildLeasePdf(lines: string[]): Uint8Array {
  const safe = lines.map((l) => escapePdfText(l.slice(0, 110)));
  const content =
    'BT /F1 16 Tf 56 780 Td (RocketRental lease agreement) Tj ET\n' +
    safe.map((line, i) => `BT /F1 11 Tf 56 ${744 - i * 18} Td (${line}) Tj ET`).join('\n') +
    '\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++)
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export function signedLeaseLines(input: {
  leaseId: string;
  unitLabel: string;
  tenantNames: string[];
  term: string;
  monthlyRent: string;
  deposit: string;
  clauses: string[];
  signedAt: Date;
}): string[] {
  return [
    `Lease: ${input.leaseId}`,
    `Premises: ${input.unitLabel}`,
    `Tenants: ${input.tenantNames.join(', ')}`,
    `Term: ${input.term}`,
    `Monthly rent: $${input.monthlyRent} - Deposit: $${input.deposit}`,
    ...input.clauses.map((c) => `Clause: ${c}`),
    'Signed electronically via RocketRental (mock e-signature).',
    `Signed at: ${input.signedAt.toISOString()}`,
    ...input.tenantNames.map((n) => `Signer: ${n} - signed`),
  ];
}
