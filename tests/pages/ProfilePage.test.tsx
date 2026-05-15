import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfilePage from '../../pages/ProfilePage';
import {
  createStorageProfileRepository,
  type ProfileStorage,
} from '../../src/domain/profile/profileRepository';

function createMemoryStorage(initial: Record<string, string> = {}): ProfileStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

describe('ProfilePage', () => {
  it('loads a local-first learner profile using list controls only', async () => {
    const repository = createStorageProfileRepository({
      storage: createMemoryStorage(),
      now: () => '2026-05-15T12:00:00.000Z',
    });

    render(<ProfilePage repository={repository} />);

    expect(await screen.findByRole('heading', { name: 'Learner Profile' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Current level' })).toHaveValue('A1');
    expect(screen.getByRole('combobox', { name: 'Target level' })).toHaveValue('B1');
    expect(screen.getByRole('combobox', { name: 'Native language' })).toHaveValue('english');
    expect(screen.getByRole('combobox', { name: 'Daily goal' })).toHaveValue('30');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('saves learner profile choices locally', async () => {
    const repository = createStorageProfileRepository({
      storage: createMemoryStorage(),
      now: () => '2026-05-15T12:00:00.000Z',
    });
    const onProfileChange = vi.fn();

    render(<ProfilePage repository={repository} onProfileChange={onProfileChange} />);

    await screen.findByRole('heading', { name: 'Learner Profile' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Current level' }), {
      target: { value: 'A2' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Target exam' }), {
      target: { value: 'goethe-b1' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Native language' }), {
      target: { value: 'arabic' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Daily goal' }), {
      target: { value: '45' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(onProfileChange).toHaveBeenCalledWith(
        expect.objectContaining({
          currentLevel: 'A2',
          targetExam: 'goethe-b1',
          motherLanguage: 'arabic',
          dailyGoalMinutes: 45,
        })
      );
    });
    expect(screen.getByText('Profile saved locally')).toBeInTheDocument();
    expect(screen.getByText('A2 -> B1')).toBeInTheDocument();
  });

  it('resets learner profile choices back to local defaults', async () => {
    const repository = createStorageProfileRepository({
      storage: createMemoryStorage(),
      now: () => '2026-05-15T12:00:00.000Z',
    });

    await repository.updateProfile(current => ({
      ...current,
      currentLevel: 'B2',
      motherLanguage: 'arabic',
      dailyGoalMinutes: 60,
    }));

    render(<ProfilePage repository={repository} />);

    expect(await screen.findByRole('combobox', { name: 'Current level' })).toHaveValue('B2');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Current level' })).toHaveValue('A1');
    });
    expect(screen.getByRole('combobox', { name: 'Native language' })).toHaveValue('english');
    expect(screen.getByText('Profile reset')).toBeInTheDocument();
  });
});
