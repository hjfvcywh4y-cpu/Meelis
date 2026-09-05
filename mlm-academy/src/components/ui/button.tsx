import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'default' | 'primary' | 'accent';
type Size = 'default' | 'small';

function classes(variant: Variant, size: Size, className?: string): string {
  return cn(
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'accent' && 'btn-accent',
    size === 'small' && 'btn-small',
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'default',
  size = 'default',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={classes(variant, size, className)} {...props} />;
}

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  'aria-label'?: string;
}

export function ButtonLink({
  href,
  children,
  variant = 'default',
  size = 'default',
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} className={classes(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
