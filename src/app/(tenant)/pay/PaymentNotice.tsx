'use client';

import { useEffect, useRef } from 'react';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';

export function PaymentNotice({
  tone,
  text,
  code,
  toastText,
}: {
  tone: 'success' | 'warning' | 'error';
  text: string;
  code?: string;
  toastText?: string;
}) {
  const notice = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!toastText || shown.current === toastText) return;
    shown.current = toastText;
    toast.success(toastText);
  }, [toastText, toast]);
  useEffect(() => {
    if (tone !== 'error') return;
    const input =
      code === 'invalid-amount'
        ? document.querySelector<HTMLInputElement>('input[name="amount"]')
        : null;
    (input ?? notice.current)?.focus();
  }, [code, tone, text]);
  return (
    <div id="payment-result" ref={notice} tabIndex={-1}>
      <Alert tone={tone}>{text}</Alert>
    </div>
  );
}
