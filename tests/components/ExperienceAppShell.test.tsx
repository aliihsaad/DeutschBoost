import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ExperienceAppShell from '../../components/ExperienceAppShell';

describe('ExperienceAppShell', () => {
  it('renders the approved desktop navigation in the left rail', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ExperienceAppShell>
          <main>Dashboard content</main>
        </ExperienceAppShell>
      </MemoryRouter>
    );

    const navigation = screen.getByRole('navigation', { name: 'Primary' });

    expect(within(navigation).getByRole('link', { name: /Dashboard/i })).toHaveAttribute('href', '/');
    expect(within(navigation).getByRole('link', { name: /Plan/i })).toHaveAttribute('href', '/plan');
    expect(within(navigation).getByRole('link', { name: /Mistakes/i })).toHaveAttribute('href', '/mistakes');
    expect(within(navigation).getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
  });

  it('marks the active destination using canonical and legacy routes', () => {
    render(
      <MemoryRouter initialEntries={['/learning-plan']}>
        <ExperienceAppShell>
          <main>Plan content</main>
        </ExperienceAppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Plan/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Dashboard/i })).not.toHaveAttribute('aria-current');
  });

  it('keeps provider and local storage status visible', () => {
    render(
      <MemoryRouter>
        <ExperienceAppShell>
          <main>Dashboard content</main>
        </ExperienceAppShell>
      </MemoryRouter>
    );

    expect(screen.getByText('Local files')).toBeInTheDocument();
    expect(screen.getByText('AI ready')).toBeInTheDocument();
    expect(screen.getByText('Voice ready')).toBeInTheDocument();
  });
});
