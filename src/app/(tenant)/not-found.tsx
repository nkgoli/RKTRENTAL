import { EmptyState } from '@/components/RouteStates';

export default function NotFound() {
  return (
    <EmptyState
      icon="folder"
      title="Page not found"
      description="This page may have moved or been removed."
      action="Back to home"
      href="/home"
    />
  );
}
