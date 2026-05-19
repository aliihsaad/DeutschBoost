import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Stat } from '../../../components/ui/Stat';

describe('Card/PageHeader/Stat', () => {
  it('Card renders children and optional title', () => {
    render(<Card title="Today">body</Card>);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('PageHeader renders title, subtitle, actions', () => {
    render(<PageHeader title="Dashboard" subtitle="Heute" actions={<button>Go</button>} />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Heute')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('Stat renders label and value', () => {
    render(<Stat label="Progress" value="72%" />);
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });
});
