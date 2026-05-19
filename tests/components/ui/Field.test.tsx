import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { Notice } from '../../../components/ui/Notice';

describe('Field/Badge/Notice', () => {
  it('Field associates label with control via htmlFor/id', () => {
    render(<Field label="API key" htmlFor="k"><input id="k" /></Field>);
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
  });

  it('Field shows error text', () => {
    render(<Field label="Email" htmlFor="e" error="Required"><input id="e" /></Field>);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('Badge renders tone', () => {
    render(<Badge tone="success">Configured</Badge>);
    expect(screen.getByText('Configured').className).toContain('bg-success-soft');
  });

  it('Notice renders role status/alert by tone', () => {
    render(<Notice tone="error">Failed</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });
});
