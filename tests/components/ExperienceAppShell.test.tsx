import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ExperienceAppShell from '../../components/ExperienceAppShell';
import { buildProviderSettingsSnapshots } from '../../src/domain/settings/providerSettings';

describe('ExperienceAppShell', () => {
  it('renders only ready desktop destinations in the primary left rail', () => {
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
    expect(within(navigation).getByRole('link', { name: /Practice/i })).toHaveAttribute('href', '/practice');
    expect(within(navigation).getByRole('link', { name: /Conversation/i })).toHaveAttribute('href', '/conversation');
    expect(within(navigation).getByRole('link', { name: /Profile/i })).toHaveAttribute('href', '/profile');
    expect(within(navigation).getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
    expect(within(navigation).queryByRole('link', { name: /Review/i })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: /Writing/i })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: /Mistakes/i })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: /Exam/i })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: /Library/i })).not.toBeInTheDocument();
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
    expect(screen.getByText('Gemini Live off')).toBeInTheDocument();
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
      live: {
        enabled: true,
        provider: 'gemini-live',
        apiKey: 'gemini-key',
        model: 'gemini-3.1-flash-live-preview',
        voiceName: 'Kore',
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
    expect(screen.getByText('Gemini Live ready')).toBeInTheDocument();
  });
});
