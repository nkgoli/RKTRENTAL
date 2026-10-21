import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconKey } from '../shell/Icons';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'light';

type Common = {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
  /** 18px stroked icon rendered before the label (never a typed "+"). */
  icon?: IconKey;
  children?: ReactNode;
};

type ButtonProps = Common & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof Common
  >;
type LinkButtonProps = Common & { href: string };

export function Button(props: ButtonProps | LinkButtonProps) {
  const { variant = 'secondary', size = 'md', block, className, children, icon } = props;
  const classes = cx(
    'btn',
    `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className,
  );
  const content = (
    <>
      {icon && <Icon name={icon} />}
      {children}
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link className={classes} href={props.href}>
        {content}
      </Link>
    );
  }
  const { type = 'button', ...rest } = props as ButtonProps;
  const native: Record<string, unknown> = { ...rest };
  for (const key of ['variant', 'size', 'block', 'className', 'children', 'href', 'icon']) {
    delete native[key];
  }
  return (
    <button className={classes} type={type} {...native}>
      {content}
    </button>
  );
}
