import { EmptyState } from '@/components/RouteStates';

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="This page is unavailable. Return home to continue."
      action="Back to home"
      href="/home"
    />
  );
}
