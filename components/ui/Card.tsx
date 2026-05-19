import React from 'react';
import { cn } from './cn';

export interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'soft' | 'interactive';
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

export const Card: React.FC<CardProps> = ({
  children, title, actions, footer, variant = 'default', className, onClick, ...rest
}) => (
  <section
    {...rest}
    onClick={onClick}
    className={cn(
      'rounded-card border border-border bg-surface p-5 shadow-soft',
      variant === 'soft' && 'bg-surface-soft shadow-none',
      variant === 'interactive' && 'cursor-pointer transition-colors hover:border-brand',
      className,
    )}
  >
    {(title || actions) && (
      <div className="mb-4 flex items-center justify-between gap-3">
        {title && <h2 className="text-[16px] font-semibold text-text">{title}</h2>}
        {actions}
      </div>
    )}
    {children}
    {footer && <div className="mt-4 border-t border-border pt-3">{footer}</div>}
  </section>
);
