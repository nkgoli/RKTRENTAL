import { describe, expect, it } from 'vitest';
import { STANDARD_V2_ITEMS } from '@/lib/lease-create/standard-v2';
import { contextFromDraft, createTermsSnapshot, resolveTerms, STANDARD_FEES } from '@/lib/lease-create/templates';
import { emptyDraft } from '@/lib/lease-create/types';

const template = { id: 'standard-v2', name: 'Standard residential lease', version: 2,
  items: STANDARD_V2_ITEMS, defaultFees: STANDARD_FEES };

describe('standard residential lease v2', () => {
  it('has the complete ordered source sections', () => {
    expect(STANDARD_V2_ITEMS.filter((item) => item.section === 'CLAUSE')).toHaveLength(42);
    expect(STANDARD_V2_ITEMS.filter((item) => item.section === 'RULE')).toHaveLength(21);
    expect(STANDARD_V2_ITEMS.filter((item) => item.section === 'DISCLOSURE')).toHaveLength(8);
    expect(STANDARD_V2_ITEMS.map((item) => item.order)).toEqual(Array.from({ length: 71 }, (_, index) => index));
    expect(STANDARD_V2_ITEMS[0]?.title).toBe('Rent');
    expect(STANDARD_V2_ITEMS[41]?.title).toBe('Governing Law');
    expect(STANDARD_V2_ITEMS[42]?.title).toBe('Locks.');
    expect(STANDARD_V2_ITEMS[70]?.title).toBe('Smoking policy.');
    expect(STANDARD_V2_ITEMS[0]?.body).toContain('Rent is not considered paid until Lessor actually receives cleared funds.');
  });

  it('applies property, unit, deposit, pet, term and parking conditions', () => {
    const draft = emptyDraft({ template, leaseType: 'fixed', propertyType: 'MULTI_UNIT',
      yearBuilt: 1970, balconyPatio: true, sharedLaundry: true, floodZone: true,
      deposit: '1200', assignedParking: true, options: ['pets-allowed'] });
    const included = resolveTerms(template, contextFromDraft(draft)).filter((item) => item.included).map((item) => item.id);
    for (const id of ['clause-05', 'clause-22', 'clause-25', 'clause-27', 'rule-13', 'rule-14',
      'rule-15', 'disclosure-01', 'disclosure-05', 'disclosure-06']) expect(included).toContain(id);
    for (const id of ['clause-06', 'clause-23', 'clause-26', 'rule-10']) expect(included).not.toContain(id);
  });

  it('fills known lease values, leaves an editable blank, and freezes the sent text', () => {
    const draft = emptyDraft({ template, monthlyRent: '1600', rentDueDay: 5,
      startDate: '2027-02-01', deposit: '1600', occupants: 'Alex Rivera',
      tenantUtilities: ['Electricity'], placeholderValues: { deposit_institution: 'Example Bank' } });
    const snapshot = createTermsSnapshot(template, contextFromDraft(draft));
    expect(snapshot.items.find((item) => item.id === 'clause-01')?.body).toContain('$1600.00');
    expect(snapshot.items.find((item) => item.id === 'clause-03')?.body).toContain('Example Bank');
    expect(snapshot.items.find((item) => item.id === 'clause-13')?.body).toContain('Electricity');
    expect(snapshot.items.find((item) => item.id === 'clause-02')?.body).toContain('{{returned_payment_fee}}');
    draft.monthlyRent = '2000';
    expect(snapshot.items.find((item) => item.id === 'clause-01')?.body).toContain('$1600.00');
    expect(snapshot.template.version).toBe(2);
  });
});
