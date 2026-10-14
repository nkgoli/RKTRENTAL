'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui';

export function FeeSwitch({
  name,
  initial,
  label,
}: {
  name: string;
  initial: boolean;
  label: string;
}) {
  const [on, setOn] = useState(initial);
  return (
    <>
      <input type="hidden" name={name} value={on ? 'true' : 'false'} />
      <Switch on={on} label={label} onChange={setOn} />
    </>
  );
}
