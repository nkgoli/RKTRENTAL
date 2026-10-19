'use client';

import { useEffect, useRef } from 'react';
import { Alert } from '@/components/ui/Feedback';

export function PaymentNotice({
  tone,
  text,
  code,
}: {
  tone: 'success' | 'warning' | 'error';
  text: string;
  code?: string;
}) {
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tone !== 'error') return;
    const input =
      code === 'invalid-amount'
        ? document.querySelector<HTMLInputElement>('input[name="amount"]')
        : null;
    (input ?? notice.current)?.focus();
  }, [code, tone, text]);
  return (
    <div ref={notice} tabIndex={-1}>
      <Alert tone={tone}>{text}</Alert>
    </div>
  );
}
