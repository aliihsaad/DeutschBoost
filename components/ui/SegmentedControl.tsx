import React from 'react';
import { cn } from './cn';

export interface SegOption { value: string; label: string }

export const SegmentedControl: React.FC<{
  ariaLabel: string; value: string; options: SegOption[]; onChange: (v: string) => void;
}> = ({ ariaLabel, value, options, onChange }) => (
  <div role="group" aria-label={ariaLabel} className="inline-flex rounded-control border border-border bg-surface p-1">
    {options.map(o => (
      <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
        className={cn('rounded-[6px] px-3 py-1.5 text-[13px] font-medium',
          o.value === value ? 'bg-brand text-text' : 'text-text-muted hover:bg-surface-soft')}>
        {o.label}
      </button>
    ))}
  </div>
);
