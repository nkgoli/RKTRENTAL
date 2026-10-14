import { PageHeader } from '@/components/shell/PageHeader';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        eyebrow="Properties"
        title={`Property ${id}`}
        actions={[{ label: 'Back to properties', href: '/properties' }]}
      />
      <PlaceholderPage name="Property detail" />
    </>
  );
}
