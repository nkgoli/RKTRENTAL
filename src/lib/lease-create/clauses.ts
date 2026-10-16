export type ClauseOption = { id: string; label: string; description: string };

export const CLAUSE_OPTIONS: ClauseOption[] = [
  {
    id: 'residential-use',
    label: 'Residential use only',
    description: 'The unit may be used only as a private residence.',
  },
  {
    id: 'utilities',
    label: 'Tenant responsible for utilities listed in the agreement',
    description: 'Utilities named in the lease stay in the tenant’s name.',
  },
  {
    id: 'no-smoking',
    label: 'No smoking inside the unit',
    description: 'Smoking is not permitted inside the home.',
  },
  {
    id: 'pets',
    label: 'Add pet agreement',
    description: 'Approved pets only, with the pet addendum attached.',
  },
  {
    id: 'maintenance-access',
    label: 'Maintenance access with notice',
    description: 'The manager may enter with advance notice for repairs and inspections.',
  },
  {
    id: 'renters-insurance',
    label: 'Renters insurance required',
    description: 'The tenant keeps an active renters insurance policy.',
  },
];

export const OPTION_CHOICES: ClauseOption[] = [
  {
    id: 'autopay',
    label: 'Offer autopay to the tenant',
    description: 'The tenant can set up automatic monthly rent payments from the portal.',
  },
  {
    id: 'pets-allowed',
    label: 'Pets allowed',
    description: 'Approved pets may live in the unit under the pet terms.',
  },
  {
    id: 'subletting',
    label: 'Subletting allowed with written consent',
    description: 'The tenant may sublet only after the manager approves in writing.',
  },
  {
    id: 'auto-renew',
    label: 'Renew month to month after the term ends',
    description: 'The lease continues month to month unless either side gives notice.',
  },
];

export const RULE_OPTIONS: ClauseOption[] = [
  {
    id: 'quiet-hours',
    label: 'Quiet hours 10 pm – 7 am',
    description: 'Keep noise down so neighbors can rest.',
  },
  {
    id: 'trash',
    label: 'Trash and recycling in the provided bins',
    description: 'Place bins at the curb on collection days only.',
  },
  {
    id: 'parking',
    label: 'Park only in assigned spaces',
    description: 'Vehicles outside assigned spaces may be towed.',
  },
  {
    id: 'guests',
    label: 'Guests may stay up to 14 days',
    description: 'Longer stays need the manager’s written approval.',
  },
  {
    id: 'no-alterations',
    label: 'No alterations without written consent',
    description: 'Painting, fixtures and locks stay as delivered unless approved.',
  },
];

export const DISCLOSURE_OPTIONS: ClauseOption[] = [
  {
    id: 'lead-paint',
    label: 'Lead-based paint disclosure',
    description: 'Required for homes built before 1978.',
  },
  {
    id: 'mold',
    label: 'Mold disclosure',
    description: 'Known moisture or mold conditions in the unit.',
  },
  {
    id: 'bed-bugs',
    label: 'Bed bug disclosure',
    description: 'Pest history and prevention steps.',
  },
  {
    id: 'security-deposit-terms',
    label: 'Security deposit terms',
    description: 'Where the deposit is held and how it is returned.',
  },
  {
    id: 'flood-zone',
    label: 'Flood zone disclosure',
    description: 'The property sits in a mapped flood hazard area.',
  },
];

export const STANDARD_DOCUMENTS = [
  'Standard lease template',
  'Lead-based paint disclosure (when required)',
] as const;

const pick = (list: ClauseOption[], ids: string[]) =>
  ids
    .map((id) => list.find((c) => c.id === id)?.label)
    .filter((v): v is string => Boolean(v));

export const clauseLabels = (ids: string[]) => pick(CLAUSE_OPTIONS, ids);
export const optionLabels = (ids: string[]) => pick(OPTION_CHOICES, ids);
export const ruleLabels = (ids: string[]) => pick(RULE_OPTIONS, ids);
export const disclosureLabels = (ids: string[]) => pick(DISCLOSURE_OPTIONS, ids);
