import React from 'react';

export interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, hint }) => (
  <div className="rounded-card border border-border bg-surface p-4">
    <div className="text-[12px] font-medium uppercase tracking-wide text-text-muted">{label}</div>
    <div className="mt-1 text-[22px] font-bold text-text">{value}</div>
    {hint && <div className="mt-1 text-[12px] text-text-muted">{hint}</div>}
  </div>
);
