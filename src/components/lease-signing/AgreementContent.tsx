import type { ReactNode } from 'react';
import styles from './signing.module.css';

export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const items = (value: unknown) => (Array.isArray(value) ? value.map(record) : []);
const text = (value: unknown) => (value == null || value === '' ? 'Not specified' : String(value));
const money = (value: unknown) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));
const date = (value: unknown) => String(value ?? '').slice(0, 10);

export function DocumentLinks({
  id,
  name,
  preview = true,
}: {
  id: string;
  name: string;
  preview?: boolean;
}) {
  return (
    <span className={styles.actions}>
      {preview && (
        <a
          className="btn btn-secondary"
          href={`/api/files/${encodeURIComponent(id)}/preview`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Preview ${name} (opens in a new tab)`}
        >
          Preview
        </a>
      )}
      <a
        className="btn btn-secondary"
        href={`/api/files/${encodeURIComponent(id)}/download`}
        aria-label={`Download ${name}`}
      >
        Download
      </a>
    </span>
  );
}

/** All operative wording comes from the immutable reviewed snapshot, never live templates. */
export function AgreementContent({ snapshot }: { snapshot: unknown }) {
  const s = record(snapshot),
    property = record(s.property),
    lessor = record(s.lessor);
  const wizard = record(s.wizard),
    terms = record(s.termsSnapshot),
    selected = record(s.selectedText);
  const resolved = items(terms.items).filter((item) => item.included !== false);
  const facts: [string, ReactNode][] = [
    [
      'Property',
      [property.name, property.street, property.city, property.state, property.postalCode]
        .filter(Boolean)
        .join(', '),
    ],
    ['Unit', text(record(s.unit).number)],
    ['Lessor', text(lessor.name)],
    ['Signing representative', `${text(lessor.signingName)} · ${text(lessor.email)}`],
    [
      'Tenants',
      items(s.parties)
        .filter((p) => p.role === 'TENANT')
        .map((p) => text(p.expectedName))
        .join(', '),
    ],
    ['Term', `${date(s.startDate)} – ${date(s.endDate)}`],
    ['Monthly rent', `${money(s.monthlyRent)} · due on day ${text(s.rentDueDay)}`],
    ['Security deposit', money(s.deposit)],
    ['Late fee', `${money(s.lateFee)} after ${text(s.graceDays)} days`],
    ['Move-in fee', money(s.moveInFee)],
    ['Pet deposit', money(s.petDeposit)],
    ['First month proration', s.prorateFirstMonth ? 'Yes' : 'No'],
    ['Occupants', text(s.occupants)],
    ['Lease type', text(wizard.leaseType)],
    ['Renewal notice', `${text(wizard.renewalNoticeDays)} days`],
    ['Returned payment fee', money(wizard.returnedPaymentFee)],
    ['Key fee', money(wizard.keyFee)],
    [
      'Tenant utilities',
      Array.isArray(wizard.tenantUtilities)
        ? wizard.tenantUtilities.join(', ') || 'None'
        : 'Not specified',
    ],
    ['Assigned parking', wizard.assignedParking ? 'Yes' : 'No'],
    ['Property type', text(wizard.propertyType)],
    ['Year built', text(wizard.yearBuilt)],
    ['Balcony / patio', wizard.balconyPatio ? 'Yes' : 'No'],
    ['Shared laundry', wizard.sharedLaundry ? 'Yes' : 'No'],
    ['Flood zone', wizard.floodZone ? 'Yes' : 'No'],
    ['Lessor address', text(wizard.lessorAddress)],
    ['Lessor phone', text(wizard.lessorPhone)],
  ];
  return (
    <section className={styles.agreement} aria-label="Full agreement">
      <h2>Full agreement</h2>
      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {resolved.map((item, index) => (
        <section key={index}>
          <h3>{text(item.title)}</h3>
          <p className={styles.wording}>{text(item.body)}</p>
        </section>
      ))}
      {['options', 'clauses', 'rules', 'disclosures'].map((group) =>
        items(selected[group]).map((item, index) => (
          <section key={`${group}-${index}`}>
            <h3>{text(item.label)}</h3>
            <p className={styles.wording}>{text(item.description)}</p>
          </section>
        )),
      )}
      {['customClause', 'customRules'].map((key) =>
        wizard[key] ? (
          <section key={key}>
            <h3>{key === 'customClause' ? 'Additional clause' : 'Additional rules'}</h3>
            <p className={styles.wording}>{text(wizard[key])}</p>
          </section>
        ) : null,
      )}
      <section>
        <h3>Separate addendums</h3>
        <p>
          Review each original file. These files remain separate from the final signed lease PDF.
        </p>
        {!items(s.addendums).length && <p>No addendums included.</p>}
        {items(s.addendums).map((file) => (
          <div className={styles.file} key={text(file.documentId)}>
            <strong>{text(file.name)}</strong>
            <DocumentLinks
              id={text(file.documentId)}
              name={text(file.name)}
              preview={
                file.mimeType === 'application/pdf' || String(file.mimeType).startsWith('image/')
              }
            />
          </div>
        ))}
      </section>
    </section>
  );
}
