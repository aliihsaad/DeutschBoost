import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PracticePage } from '../../pages/PracticePage';

describe('PracticePage', () => {
  it('does not expose the unfinished mock exam simulator as a ready feature', () => {
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Practice Hub/i })).toBeInTheDocument();
    expect(screen.queryByText(/Goethe Mock Exam Simulator/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Mock Exam/i })).not.toBeInTheDocument();
  });
});
