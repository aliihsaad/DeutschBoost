import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <header className="mb-6 flex items-end justify-between gap-4">
    <div>
      <h1 className="text-[24px] font-bold tracking-tight text-text">{title}</h1>
      {subtitle && <p className="mt-1 text-[14px] text-text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>
);
