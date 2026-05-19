import React from 'react';
import { Button } from './Button';

export const EmptyState: React.FC<{
  title: string; description?: string; icon?: React.ReactNode;
  actionLabel?: string; onAction?: () => void;
}> = ({ title, description, icon, actionLabel, onAction }) => (
  <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface-soft p-10 text-center">
    {icon && <div className="text-text-muted">{icon}</div>}
    <h3 className="text-[16px] font-semibold text-text">{title}</h3>
    {description && <p className="max-w-md text-[13px] text-text-muted">{description}</p>}
    {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
  </div>
);
