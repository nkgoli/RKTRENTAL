import { LoadingState } from '@/components/RouteStates';

/**
 * Gives each property its own Suspense boundary. Without it, opening a property from the
 * directory (or another property) suspends inside the already-visible manager boundary, so
 * React holds the transition on the old screen; a Flight chunk that resolves synchronously
 * mid-render then drops React's retry ping and the card click never navigates.
 */
export default function Loading() {
  return <LoadingState variant="detail" />;
}
