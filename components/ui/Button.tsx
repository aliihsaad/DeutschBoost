import React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-text hover:bg-brand-strong hover:text-white',
  secondary: 'bg-surface-soft text-text border border-border hover:bg-border/40',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-soft',
  danger: 'bg-danger text-white hover:brightness-95',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
      size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-[14px]',
      VARIANTS[variant],
      className,
    )}
  >
    {loading ? <span className="animate-spin">◌</span> : icon}
    {children}
  </button>
);
