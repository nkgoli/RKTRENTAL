'use client';

import type { SelectHTMLAttributes } from 'react';

/** A filter select that submits its form as soon as the choice changes, so the filter needs no Apply button. */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
