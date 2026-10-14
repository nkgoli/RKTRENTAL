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

export const STANDARD_DOCUMENTS = [
  'Standard lease template',
  'Lead-based paint disclosure (when required)',
] as const;

export function clauseLabels(ids: string[]): string[] {
  return ids
    .map((id) => CLAUSE_OPTIONS.find((c) => c.id === id)?.label)
    .filter((v): v is string => Boolean(v));
}
