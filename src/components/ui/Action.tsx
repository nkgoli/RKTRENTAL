import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconKey } from '../shell/Icons';
import { cx } from './cx';

/** Workspace action glyphs that the shell icon set does not carry. */
const glyphs = {
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 21h4" />,
  history: <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7M4 4v4.7h4.7M12 8v4.5l3 2" />,
  signature: <path d="M3 19c3-1 4-5 6-9s4-4 4-1-3 7-1 8 4-3 5-3 1 2 4 2M3 22h18" />,
  external: (
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  ),
} as const;

export type ActionIcon = IconKey | keyof typeof glyphs;
export type ActionTone = 'quiet' | 'secondary' | 'primary';

export function ActionGlyph({ name }: { name: ActionIcon }) {
  if (name in glyphs) {
    return (
      <svg
        focusable="false"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyphs[name as keyof typeof glyphs]}
      </svg>
    );
  }
  return <Icon name={name as IconKey} />;
}

type Common = {
  icon: ActionIcon;
  /** Accessible name; also the hover/focus tooltip when the visible text is omitted or shortened. */
  label: string;
  /** Short visible text. Omit for an icon-only action; keep it a word or two from `label`. */
  text?: ReactNode;
  tone?: ActionTone;
  /** Put the icon after the text: use for "go to" navigation arrows and chevrons. */
  trailing?: boolean;
  className?: string;
};

/** `document` renders a plain anchor for full-document navigation (lease section links). */
type LinkAction = Common & { href: string; document?: boolean };
type ButtonAction = Common & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof Common
  >;

/**
 * One compact workspace action: stroked icon, short visible text and a full accessible name.
 * Icon-only actions show `label` as a tooltip on hover and keyboard focus.
 */
export function Action(props: LinkAction | ButtonAction) {
  const { icon, label, text, tone = 'quiet', trailing, className } = props;
  const iconOnly = text == null;
  const classes = cx('action', `action-${tone}`, iconOnly && 'action-icon', className);
  const named = iconOnly || typeof text !== 'string' || text !== label;
  const a11y = {
    'aria-label': named ? label : undefined,
    'data-tip': iconOnly || (typeof text === 'string' && text !== label) ? label : undefined,
  };
  const content = (
    <>
      {!trailing && <ActionGlyph name={icon} />}
      {!iconOnly && <span>{text}</span>}
      {trailing && <ActionGlyph name={icon} />}
    </>
  );
  if (props.href !== undefined) {
    return props.document ? (
      <a className={classes} href={props.href} {...a11y}>
        {content}
      </a>
    ) : (
      <Link className={classes} href={props.href} {...a11y}>
        {content}
      </Link>
    );
  }
  const native: Record<string, unknown> = { ...props };
  for (const key of ['icon', 'label', 'text', 'tone', 'trailing', 'className', 'href', 'document'])
    delete native[key];
  return (
    <button className={classes} type="button" {...native} {...a11y}>
      {content}
    </button>
  );
}
