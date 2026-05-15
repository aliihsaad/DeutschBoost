import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ExperienceAppShell from '../../components/ExperienceAppShell';
import { buildProviderSettingsSnapshots } from '../../src/domain/settings/providerSettings';

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
    expect(within(navigation).getByRole('link', { name: /Profile/i })).toHaveAttribute('href', '/profile');
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

  it('shows local storage and disabled provider status by default', () => {
    render(
      <MemoryRouter>
        <ExperienceAppShell>
          <main>Dashboard content</main>
        </ExperienceAppShell>
      </MemoryRouter>
    );

    expect(screen.getByText('Local files')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter off')).toBeInTheDocument();
    expect(screen.getByText('Deepgram off')).toBeInTheDocument();
  });

  it('shows configured provider status from local settings', () => {
    const providerSettings = buildProviderSettingsSnapshots({
      ai: {
        enabled: true,
        provider: 'openrouter',
        apiKey: 'openrouter-key',
        model: 'openai/gpt-4o-mini',
      },
      speech: {
        enabled: true,
        provider: 'deepgram',
        apiKey: 'deepgram-key',
        model: 'nova-3',
        language: 'de',
      },
    });

    render(
      <MemoryRouter>
        <ExperienceAppShell providerSettings={providerSettings}>
          <main>Dashboard content</main>
        </ExperienceAppShell>
      </MemoryRouter>
    );

    expect(screen.getByText('OpenRouter ready')).toBeInTheDocument();
    expect(screen.getByText('Deepgram ready')).toBeInTheDocument();
  });
});
