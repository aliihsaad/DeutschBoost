import React from 'react';
import { cn } from './cn';

type Tone = 'info' | 'success' | 'error';

const TONES: Record<Tone, string> = {
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
};

export const Notice: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-control px-3 py-2 text-[13px]', TONES[tone])}>
    {children}
  </div>
);
