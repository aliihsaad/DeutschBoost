import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PracticePage } from '../../pages/PracticePage';

describe('PracticePage', () => {
  it('exposes the Goethe exam simulator from the practice hub', () => {
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Practice Hub/i })).toBeInTheDocument();
    expect(screen.getByText(/Goethe Exam Simulator/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Exam Simulator/i })).toBeInTheDocument();
  });
});
