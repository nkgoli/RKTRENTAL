'use client';

import { RouteError } from '@/components/RouteError';
import { Button } from '@/components/ui/Button';

export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <RouteError {...props} tenant />
      <Button href="/home">Back to home</Button>
    </>
  );
}
