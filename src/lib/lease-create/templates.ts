/** The stored template definition is copied into every draft and signed snapshot. */
export type TemplateSection = 'CLAUSE' | 'RULE' | 'DISCLOSURE';
export const INCLUDE_WHEN = [
  'ALWAYS', 'FIXED_TERM', 'MONTH_TO_MONTH', 'PETS_ALLOWED', 'NO_PETS',
  'ASSIGNED_PARKING', 'MULTI_UNIT', 'SINGLE_FAMILY', 'TENANT_UTILITIES', 'PRE_1978',
  'BALCONY_PATIO', 'SHARED_LAUNDRY', 'FLOOD_ZONE', 'SECURITY_DEPOSIT',
] as const;
export type IncludeWhen = (typeof INCLUDE_WHEN)[number];
export type TemplateItem = {
  id: string;
  section: TemplateSection;
  title: string;
  body: string;
  order: number;
  required: boolean;
  includeWhen: IncludeWhen;
};
export type TemplateFees = {
  lateFee: string;
  graceDays: number;
  moveInFee: string;
  petDeposit: string;
  returnedPaymentFee?: string;
  keyFee?: string;
};
export type TemplateDefinition = {
  id: string;
  name: string;
  version: number;
  items: TemplateItem[];
  defaultFees: TemplateFees;
};
export type TermOverride = {
  included?: boolean;
  title?: string;
  body?: string;
  section?: TemplateSection;
};
export type TermsContext = {
  leaseType: 'fixed' | 'month-to-month';
  petsAllowed: boolean;
  petFee: boolean;
  assignedParking: boolean;
  propertyType: 'SINGLE_UNIT' | 'MULTI_UNIT';
  tenantUtilities: string[];
  yearBuilt: number | null;
  balconyPatio?: boolean;
  sharedLaundry?: boolean;
  floodZone?: boolean;
  securityDeposit?: boolean;
  values?: Record<string, string>;
};
export type ResolvedTerm = TemplateItem & {
  included: boolean;
  reason: string;
  edited: boolean;
  changed?: boolean;
};

export function contextFromDraft(draft: {
  leaseType: TermsContext['leaseType']; options: string[]; petDepositEnabled: boolean;
  assignedParking: boolean; propertyType: TermsContext['propertyType'];
  tenantUtilities: string[]; yearBuilt: number | null;
  balconyPatio?: boolean; sharedLaundry?: boolean; floodZone?: boolean;
  deposit?: string; monthlyRent?: string; rentDueDay?: number; startDate?: string; endDate?: string;
  lateFee?: string; graceDays?: number; occupants?: string; petDeposit?: string;
  returnedPaymentFee?: string; keyFee?: string;
  lessorName?: string; lessorAddress?: string; lessorPhone?: string;
  renewalNoticeDays?: number; placeholderValues?: Record<string, string>;
}): TermsContext {
  const amount = (value?: string) => value && Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : '';
  const values: Record<string, string> = {
    monthly_rent: amount(draft.monthlyRent), rent_due_day: String(draft.rentDueDay ?? ''),
    start_date: draft.startDate ?? '', end_date: draft.endDate ?? '',
    security_deposit: amount(draft.deposit), late_fee: amount(draft.lateFee),
    grace_period_days: String(draft.graceDays ?? ''), occupants: draft.occupants ?? '',
    tenant_paid_utilities: draft.tenantUtilities.join(', '),
    pet_deposit: amount(draft.petDeposit), nonrenewal_notice_days: String(draft.renewalNoticeDays ?? ''),
    returned_payment_fee: amount(draft.returnedPaymentFee), key_fee: amount(draft.keyFee),
    owner_agent_name: draft.lessorName ?? '', owner_agent_address: draft.lessorAddress ?? '',
    lessor_notice_address: draft.lessorAddress ?? '', emergency_phone: draft.lessorPhone ?? '',
  };
  return { leaseType: draft.leaseType, petsAllowed: draft.options.includes('pets-allowed'),
    petFee: draft.petDepositEnabled, assignedParking: draft.assignedParking,
    propertyType: draft.propertyType, tenantUtilities: draft.tenantUtilities, yearBuilt: draft.yearBuilt,
    balconyPatio: draft.balconyPatio, sharedLaundry: draft.sharedLaundry, floodZone: draft.floodZone,
    securityDeposit: Number(draft.deposit) > 0, values: { ...values, ...draft.placeholderValues } };
}

export const CONDITION_LABELS: Record<IncludeWhen, string> = {
  ALWAYS: 'Always', FIXED_TERM: 'Fixed term', MONTH_TO_MONTH: 'Month-to-month',
  PETS_ALLOWED: 'Pets allowed or pet fee set', NO_PETS: 'No pets',
  ASSIGNED_PARKING: 'Assigned parking', MULTI_UNIT: 'Multi-unit property',
  SINGLE_FAMILY: 'Single-family home', TENANT_UTILITIES: 'Tenant pays utilities',
  PRE_1978: 'Built before 1978',
  BALCONY_PATIO: 'Unit has balcony or patio', SHARED_LAUNDRY: 'Shared laundry',
  FLOOD_ZONE: 'Property is in a flood zone', SECURITY_DEPOSIT: 'Security deposit set',
};

export function conditionReason(condition: IncludeWhen, context: TermsContext): string | null {
  switch (condition) {
    case 'ALWAYS': return 'Included by the template';
    case 'FIXED_TERM': return context.leaseType === 'fixed' ? 'Added because this is a fixed-term lease' : null;
    case 'MONTH_TO_MONTH': return context.leaseType === 'month-to-month' ? 'Added because this lease is month-to-month' : null;
    case 'PETS_ALLOWED': return context.petsAllowed || context.petFee ? 'Added because pets are allowed or a pet fee is set' : null;
    case 'NO_PETS': return !context.petsAllowed && !context.petFee ? 'Added because pets are not allowed' : null;
    case 'ASSIGNED_PARKING': return context.assignedParking ? 'Added because parking is assigned' : null;
    case 'MULTI_UNIT': return context.propertyType === 'MULTI_UNIT' ? 'Added because this is a multi-unit property' : null;
    case 'SINGLE_FAMILY': return context.propertyType === 'SINGLE_UNIT' ? 'Added because this is a single-family home' : null;
    case 'TENANT_UTILITIES': return context.tenantUtilities.length ? `Added because the tenant pays ${context.tenantUtilities.join(', ')}` : null;
    case 'PRE_1978': return context.yearBuilt !== null && context.yearBuilt < 1978 ? 'Added because the home was built before 1978' : null;
    case 'BALCONY_PATIO': return context.balconyPatio ? 'Added because the unit has a balcony or patio' : null;
    case 'SHARED_LAUNDRY': return context.sharedLaundry ? 'Added because the property has shared laundry' : null;
    case 'FLOOD_ZONE': return context.floodZone ? 'Added because the property is in a flood zone' : null;
    case 'SECURITY_DEPOSIT': return context.securityDeposit ? 'Added because a security deposit is set' : null;
  }
}

export function resolveTerms(
  definition: TemplateDefinition,
  context: TermsContext,
  overrides: Record<string, TermOverride> = {},
  previous: TemplateItem[] = [],
): ResolvedTerm[] {
  const source = [...definition.items];
  for (const [id, override] of Object.entries(overrides)) {
    if (source.some((item) => item.id === id) || !override.section) continue;
    source.push({ id, section: override.section, title: override.title ?? '', body: override.body ?? '',
      order: source.length, required: false, includeWhen: 'ALWAYS' });
  }
  return source.sort((a, b) => a.order - b.order).map((item) => {
    const override = overrides[item.id] ?? {};
    const reason = conditionReason(item.includeWhen, context);
    const included = override.included ?? Boolean(reason);
    const title = override.title ?? item.title;
    const sourceBody = override.body ?? (item.includeWhen === 'TENANT_UTILITIES' && !item.body.includes('{{tenant_paid_utilities}}') && context.tenantUtilities.length
      ? `The tenant will arrange and pay for ${context.tenantUtilities.join(', ')} and keep those services active during the tenancy.`
      : item.body);
    const body = sourceBody.replace(/\{\{([a-z_]+)\}\}/g, (token, key: string) => context.values?.[key]?.trim() || token);
    const old = previous.find((entry) => entry.id === item.id);
    return { ...item, title, body, included,
      reason: override.included !== undefined ? 'Selected manually' : reason ?? 'Condition is not met',
      edited: override.title !== undefined || override.body !== undefined || Boolean(override.section),
      changed: previous.length > 0 && (Boolean(old) !== included || (old && (old.title !== title || old.body !== body))),
    };
  });
}

export function createTermsSnapshot(
  definition: TemplateDefinition,
  context: TermsContext,
  overrides: Record<string, TermOverride> = {},
) {
  const items = resolveTerms(definition, context, overrides)
    .filter((item) => item.included)
    .map(({ id, section, title, body, order, required, includeWhen }) =>
      ({ id, section, title, body, order, required, includeWhen }));
  return {
    template: { ...definition, defaultFees: { ...definition.defaultFees },
      items: definition.items.map((item) => ({ ...item })) },
    context: { ...context, tenantUtilities: [...context.tenantUtilities], values: { ...context.values } },
    items,
    overrides: Object.fromEntries(Object.entries(overrides).map(([id, value]) => [id, { ...value }])),
  };
}

const item = (id: string, section: TemplateSection, title: string, body: string, includeWhen: IncludeWhen = 'ALWAYS', required = false, order = 0): TemplateItem =>
  ({ id, section, title, body, order, required, includeWhen });

/** Original product copy. Managers must still review local law and the facts of each property. */
export const STANDARD_ITEMS: TemplateItem[] = [
  item('residential-use', 'CLAUSE', 'Residential use', 'Use the home as a residence. Ask the manager before using it for a business or short-term rental.', 'ALWAYS', true, 0),
  item('deposit', 'CLAUSE', 'Security deposit', 'Pay the deposit shown in the rent section before move-in. The manager will handle and return it under applicable law.', 'ALWAYS', true, 1),
  item('access', 'CLAUSE', 'Access for repairs', 'The manager may enter for repairs or inspection after giving the notice required by law, except in an emergency.', 'ALWAYS', true, 2),
  item('early-termination', 'CLAUSE', 'Ending a fixed term early', 'A request to leave before the end date must be made in writing. Any amount owed is determined by this agreement and applicable law.', 'FIXED_TERM', false, 3),
  item('monthly-notice', 'CLAUSE', 'Month-to-month notice', 'Either party may end a month-to-month tenancy by giving the written notice required by local law.', 'MONTH_TO_MONTH', false, 4),
  item('pet-agreement', 'CLAUSE', 'Approved pets', 'Only pets approved in writing may live in the home. The tenant must follow the pet agreement and pay any stated pet charge.', 'PETS_ALLOWED', false, 5),
  item('no-pets', 'CLAUSE', 'No pets', 'Pets may not live in the home without the manager’s written approval. Service and assistance animals are handled under applicable law.', 'NO_PETS', false, 6),
  item('utilities', 'CLAUSE', 'Tenant-paid utilities', 'The tenant will arrange and pay for the utilities listed in this lease, and keep those services active during the tenancy.', 'TENANT_UTILITIES', false, 7),
  item('quiet-hours', 'RULE', 'Quiet hours', 'Keep noise low from 10 pm to 7 am so neighbors can rest.', 'MULTI_UNIT', false, 8),
  item('shared-areas', 'RULE', 'Shared areas', 'Keep hallways and shared spaces clear, clean, and available for all residents.', 'MULTI_UNIT', false, 9),
  item('trash', 'RULE', 'Trash and recycling', 'Use the property’s marked bins and follow the posted collection schedule.', 'MULTI_UNIT', false, 10),
  item('yard', 'RULE', 'Yard care', 'Keep the yard tidy and follow the maintenance duties listed for this home.', 'SINGLE_FAMILY', false, 11),
  item('parking', 'RULE', 'Assigned parking', 'Park only in the spaces assigned to this home. Ask the manager before using another space.', 'ASSIGNED_PARKING', false, 12),
  item('alterations', 'RULE', 'Changes to the home', 'Get written approval before painting, changing locks, or installing fixtures.', 'ALWAYS', false, 13),
  item('lead-paint', 'DISCLOSURE', 'Lead-based paint', 'For a home built before 1978, review the separate lead-based paint disclosure and required information before signing.', 'PRE_1978', true, 14),
  item('alarms', 'DISCLOSURE', 'Smoke and carbon monoxide alarms', 'The tenant will tell the manager promptly if an alarm needs service.', 'ALWAYS', false, 15),
];

export const STANDARD_FEES: TemplateFees = { lateFee: '75', graceDays: 5, moveInFee: '', petDeposit: '', returnedPaymentFee: '', keyFee: '' };
