'use client';

import { RouteError } from '@/components/RouteError';

export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} headingLevel={1} homeHref="/home" homeLabel="Back to home" />;
}
