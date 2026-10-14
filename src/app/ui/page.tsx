import { UiShowcase } from '@/components/UiShowcase';

export const metadata = { title: 'UI kit · RocketRental' };

export default function UiPage() {
  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 32px 64px' }}>
      <p className="eyebrow">Design system</p>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>UI kit</h1>
      <UiShowcase />
    </main>
  );
}
