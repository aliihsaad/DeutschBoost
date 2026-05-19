import React from 'react';
import { cn } from './cn';

export const OptionCard: React.FC<{
  label: string; description?: string; icon?: React.ReactNode;
  selected?: boolean; disabled?: boolean; onSelect: () => void;
}> = ({ label, description, icon, selected, disabled, onSelect }) => (
  <button type="button" disabled={disabled} aria-pressed={!!selected} onClick={onSelect}
    className={cn(
      'flex flex-col gap-1 rounded-card border p-4 text-left transition-colors disabled:opacity-50',
      selected ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:border-brand',
    )}>
    <span className="flex items-center gap-2 text-[14px] font-semibold text-text">{icon}{label}</span>
    {description && <span className="text-[12px] text-text-muted">{description}</span>}
  </button>
);
