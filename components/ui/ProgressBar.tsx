import React from 'react';

export const ProgressBar: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-pill bg-surface-soft">
      <div className="h-full rounded-pill bg-brand" style={{ width: `${v}%` }} />
    </div>
  );
};
