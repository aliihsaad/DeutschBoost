import React from 'react';

export interface FieldProps {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, description, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-[13px] font-medium text-text">{label}</label>
    {description && <p className="text-[12px] text-text-muted">{description}</p>}
    {children}
    {error && <p className="text-[12px] text-danger">{error}</p>}
  </div>
);
