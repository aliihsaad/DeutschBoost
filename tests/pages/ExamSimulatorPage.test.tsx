import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ExamSimulatorPage } from '../../pages/ExamSimulatorPage';

describe('ExamSimulatorPage', () => {
  it('renders an honest planned module instead of a fake interactive simulator', () => {
    render(
      <MemoryRouter>
        <ExamSimulatorPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Exam module is planned' })).toBeInTheDocument();
    expect(screen.queryByText(/Start Mock Exam/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/full-length Goethe/i)).not.toBeInTheDocument();
  });
});
