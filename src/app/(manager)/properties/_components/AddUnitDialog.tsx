'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { AddUnitForm } from './UnitForm';

export function AddUnitDialog({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const check = () => { if (window.location.hash === '#add-unit') setOpen(true); };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  return <>
    <Button size="sm" icon="plus" onClick={() => setOpen(true)}>Add unit</Button>
    <Dialog open={open} onClose={close} title="Add unit">
      <AddUnitForm propertyId={propertyId} onSaved={close} />
    </Dialog>
  </>;
}
