'use client';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import styles from './tenants.module.css';

export function PaymentHistory({ children, count }: { children: ReactNode; count: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={styles.paymentHistory} data-expanded={expanded}>
      {children}
      {count > 3 && (
        <Button
          className={styles.paymentToggle}
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show latest 3' : `Show all ${count} on this page`}
        </Button>
      )}
    </div>
  );
}
