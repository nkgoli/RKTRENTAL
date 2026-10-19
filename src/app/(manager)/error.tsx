'use client';

import { RouteError } from '@/components/RouteError';

export default function ErrorBoundary(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} homeHref="/dashboard" homeLabel="Back to dashboard" />;
}
