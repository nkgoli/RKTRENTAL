import { Card } from './ui/Card';

export function PlaceholderPage({ name }: { name: string }) {
  return (
    <Card>
      <h2 style={{ fontSize: 18 }}>{name}</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        This screen is coming soon.
      </p>
    </Card>
  );
}
