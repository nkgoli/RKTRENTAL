'use client';

import { useEffect, useRef, useState } from 'react';
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
  const input = useRef<HTMLInputElement>(null);
  const previous = useRef(initial);
  useEffect(() => {
    if (previous.current !== on) {
      previous.current = on;
      input.current?.form?.requestSubmit();
    }
  }, [on]);
  return (
    <>
      <input ref={input} type="hidden" name={name} value={on ? 'true' : 'false'} />
      <Switch on={on} label={label} onChange={setOn} />
    </>
  );
}
