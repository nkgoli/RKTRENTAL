'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui';

export function UploadDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => { if (window.location.hash === '#upload') setOpen(true); };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  return <Dialog open={open} onClose={() => {
    setOpen(false);
    if (window.location.hash === '#upload') window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }} title="Upload files" description="Choose a destination, then select files." size="lg">{children}</Dialog>;
}
