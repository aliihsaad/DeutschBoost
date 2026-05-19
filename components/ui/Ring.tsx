import React from 'react';

export const Ring: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex flex-col items-center" aria-label={label}>
      <div className="grid h-20 w-20 place-items-center rounded-pill text-[18px] font-bold text-text"
        style={{ background: `conic-gradient(var(--color-brand) ${v}%, var(--color-surface-soft) 0)` }}>
        <span className="grid h-14 w-14 place-items-center rounded-pill bg-surface">{v}%</span>
      </div>
      <span className="mt-1 text-[12px] text-text-muted">{label}</span>
    </div>
  );
};
