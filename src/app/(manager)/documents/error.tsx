'use client';
import { OperationsError } from '@/components/maintenance/OperationsError';
export default function Error({ reset }: { reset: () => void }) {
  return <OperationsError reset={reset} area="files" />;
}
