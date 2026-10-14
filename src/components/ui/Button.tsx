import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'light';

type Common = {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
  children?: ReactNode;
};

type ButtonProps = Common & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof Common
  >;
type LinkButtonProps = Common & { href: string };

export function Button(props: ButtonProps | LinkButtonProps) {
  const { variant = 'secondary', size = 'md', block, className, children } = props;
  const classes = cx(
    'btn',
    `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className,
  );
  if (props.href !== undefined) {
    return (
      <Link className={classes} href={props.href}>
        {children}
      </Link>
    );
  }
  const { type = 'button', ...rest } = props as ButtonProps;
  const native: Record<string, unknown> = { ...rest };
  for (const key of ['variant', 'size', 'block', 'className', 'children', 'href']) {
    delete native[key];
  }
  return (
    <button className={classes} type={type} {...native}>
      {children}
    </button>
  );
}
