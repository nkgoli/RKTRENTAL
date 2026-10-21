import type { ReactNode } from 'react';
import { Icon } from '../shell/Icons';
import { cx } from './cx';

/**
 * Overflow ("⋯") menu for secondary row actions. Native `<details>` so it works without JS and
 * inside server components; items are links, submit buttons or ConfirmButtons.
 */
export function RowMenu({
  label = 'More actions',
  children,
  align = 'end',
  className,
}: {
  label?: string;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  return (
    <details className={cx('row-menu', align === 'start' && 'row-menu-start', className)}>
      <summary className="icon-btn" aria-label={label} title={label}>
        <Icon name="more" />
      </summary>
      <div className="row-menu-panel" role="menu">
        {children}
      </div>
    </details>
  );
}
