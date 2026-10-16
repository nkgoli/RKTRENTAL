import { Card, CardHeader } from '@/components/ui';

export function WorkspacePlaceholder({ section, propertyId, unitId }: {
  section: string;
  propertyId: string;
  unitId?: string;
}) {
  return <Card>
    <CardHeader title={section} />
    <p className="muted">{section} for property {propertyId}{unitId ? `, unit ${unitId}` : ''} is coming soon.</p>
  </Card>;
}
