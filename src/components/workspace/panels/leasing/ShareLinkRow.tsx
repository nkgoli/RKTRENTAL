'use client';

import { useState } from 'react';
import styles from './leasing.module.css';

/** Read-only application link with a copy button. */
export function ShareLinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the field stays selectable for a manual copy.
    }
  }
  return <div className={styles.shareRow}>
    <label htmlFor="application-link">Application link</label>
    <input id="application-link" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
    <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
  </div>;
}
