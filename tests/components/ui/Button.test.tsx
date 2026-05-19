import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../components/ui/Button';

describe('Button', () => {
  it('renders label and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start exam</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Start exam' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and shows busy state while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: /Save/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('applies the variant class', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-danger');
  });
});
