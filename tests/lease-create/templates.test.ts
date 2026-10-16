import { describe, expect, it } from 'vitest';
import { coerceDraft } from '@/lib/lease-create/drafts';
import { emptyDraft } from '@/lib/lease-create/types';
import { contextFromDraft, createTermsSnapshot, resolveTerms, STANDARD_FEES, STANDARD_ITEMS } from '@/lib/lease-create/templates';

const template = { id: 'standard', name: 'Standard residential lease', version: 1,
  items: STANDARD_ITEMS, defaultFees: STANDARD_FEES };
const draft = () => emptyDraft({ template, propertyType: 'MULTI_UNIT', yearBuilt: 1964 });
const included = (d: ReturnType<typeof draft>) => resolveTerms(template, contextFromDraft(d), d.termOverrides).filter((i) => i.included);

describe('conditional lease template', () => {
  it('switches fixed-term and monthly clauses, pets, parking, property rules, utilities and lead disclosure', () => {
    const fixed = included(draft()).map((i) => i.id);
    expect(fixed).toContain('early-termination');
    expect(fixed).toContain('no-pets');
    expect(fixed).toContain('quiet-hours');
    expect(fixed).toContain('shared-areas');
    expect(fixed).toContain('trash');
    expect(fixed).toContain('lead-paint');
    expect(fixed).not.toContain('pet-agreement');
    const changed = included(emptyDraft({ ...draft(), leaseType: 'month-to-month', options: ['pets-allowed'],
      assignedParking: true, tenantUtilities: ['Electricity', 'Water'], propertyType: 'SINGLE_UNIT', yearBuilt: 1990 })).map((i) => i.id);
    expect(changed).toContain('monthly-notice');
    expect(changed).toContain('pet-agreement');
    expect(changed).toContain('parking');
    expect(changed).toContain('yard');
    expect(changed).toContain('utilities');
    expect(changed).not.toContain('no-pets');
    expect(changed).not.toContain('lead-paint');
    expect(changed).not.toContain('quiet-hours');
    expect(included(emptyDraft({ ...draft(), tenantUtilities: ['Electricity', 'Water'] }))
      .find((i) => i.id === 'utilities')?.body).toContain('Electricity, Water');
  });

  it('keeps a manual uncheck and edit when earlier choices change and a draft is restored', () => {
    const first = draft();
    first.termOverrides = { 'pet-agreement': { included: false }, 'deposit': { body: 'Custom deposit wording.' } };
    first.options = ['pets-allowed'];
    const restored = coerceDraft(JSON.parse(JSON.stringify(first)));
    restored.options = [];
    restored.options = ['pets-allowed'];
    const resolved = resolveTerms(template, contextFromDraft(restored), restored.termOverrides);
    expect(resolved.find((i) => i.id === 'pet-agreement')?.included).toBe(false);
    expect(resolved.find((i) => i.id === 'deposit')?.body).toBe('Custom deposit wording.');
    expect(resolved.find((i) => i.id === 'deposit')?.edited).toBe(true);
  });

  it('freezes the sent wording and version when the template and draft are edited later', () => {
    const d = draft();
    const originalBody = template.items[1].body;
    d.termOverrides = { deposit: { body: 'Exact agreed deposit wording.' } };
    d.tenantUtilities = ['Electricity'];
    const context = contextFromDraft(d);
    const snapshot = createTermsSnapshot(template, context, d.termOverrides);
    template.items[1].body = 'A later template change';
    d.termOverrides.deposit.body = 'A later draft change';
    context.tenantUtilities.push('Water');
    expect(snapshot.items.find((i) => i.id === 'deposit')?.body).toBe('Exact agreed deposit wording.');
    expect(snapshot.template.version).toBe(1);
    expect(snapshot.context.tenantUtilities).toEqual(['Electricity']);
    expect(snapshot.template.items[1].body).not.toBe('A later template change');
    template.items[1].body = originalBody;
  });

  it('flags re-evaluated renewal items and permits re-applying current template', () => {
    const original = createTermsSnapshot(template, contextFromDraft(draft()));
    const next = emptyDraft({ ...draft(), leaseType: 'month-to-month', options: ['pets-allowed'] });
    const renewed = resolveTerms(template, contextFromDraft(next), {}, original.items);
    expect(renewed.find((i) => i.id === 'early-termination')?.changed).toBe(true);
    expect(renewed.find((i) => i.id === 'monthly-notice')?.changed).toBe(true);
    expect(renewed.find((i) => i.id === 'pet-agreement')?.reason).toContain('pets are allowed');
  });
});
