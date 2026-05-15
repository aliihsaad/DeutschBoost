import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LocalDashboardPage from '../../pages/LocalDashboardPage';

describe('LocalDashboardPage', () => {
  it('renders the dashboard learning cockpit from the accepted concept', () => {
    render(
      <MemoryRouter>
        <LocalDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Guten Morgen!' })).toBeInTheDocument();
    expect(screen.getByText('A2 -> B1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Starten' })).toBeInTheDocument();
    expect(screen.getByText('Review Akkusativ articles')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Alles lokal gespeichert')).toBeInTheDocument();
  });

  it('shows today queue, weak areas, and weekly progress with compact labels', () => {
    render(
      <MemoryRouter>
        <LocalDashboardPage />
      </MemoryRouter>
    );

    const queue = screen.getByRole('list', { name: 'Today queue' });
    expect(within(queue).getByText('Speaking')).toBeInTheDocument();
    expect(within(queue).getByText('Writing')).toBeInTheDocument();
    expect(within(queue).getByText('Exam drill')).toBeInTheDocument();

    expect(screen.getByText('Word order')).toBeInTheDocument();
    expect(screen.getByText('der/die/das')).toBeInTheDocument();
    expect(screen.getByText('312 / 420')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
  });
});
