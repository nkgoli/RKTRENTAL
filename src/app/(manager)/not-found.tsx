import { EmptyState } from '@/components/RouteStates';

export default function NotFound() {
  return (
    <EmptyState
      eyebrow="Page unavailable"
      icon="folder"
      title="Page not found"
      description="The page may have moved or you may no longer have access to it."
      action="Back to dashboard"
      href="/dashboard"
    />
  );
}
