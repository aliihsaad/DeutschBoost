import React from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-soft text-text-muted border-border',
  brand: 'bg-brand-soft text-brand-strong border-brand-soft',
  success: 'bg-success-soft text-success border-success-soft',
  danger: 'bg-danger-soft text-danger border-danger-soft',
  info: 'bg-info-soft text-info border-info-soft',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral', children, className,
}) => (
  <span className={cn('inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[12px] font-medium', TONES[tone], className)}>
    {children}
  </span>
);
