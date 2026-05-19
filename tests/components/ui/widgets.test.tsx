import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProgressBar, Ring, EmptyState, OptionCard, SegmentedControl } from '../../../components/ui';

describe('widgets', () => {
  it('ProgressBar exposes value via aria', () => {
    render(<ProgressBar value={42} label="Plan progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Plan progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });

  it('Ring renders percentage text', () => {
    render(<Ring value={80} label="Level" />);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('EmptyState shows message and action', () => {
    const onAction = vi.fn();
    render(<EmptyState title="No exam" actionLabel="Retry" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('OptionCard toggles selected and fires select', () => {
    const onSelect = vi.fn();
    render(<OptionCard label="Free talk" selected onSelect={onSelect} />);
    const el = screen.getByRole('button', { name: /Free talk/ });
    expect(el).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(el);
    expect(onSelect).toHaveBeenCalled();
  });

  it('SegmentedControl selects an option', () => {
    const onChange = vi.fn();
    render(<SegmentedControl ariaLabel="Level" value="B1" options={[{ value: 'A1', label: 'A1' }, { value: 'B1', label: 'B1' }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'A1' }));
    expect(onChange).toHaveBeenCalledWith('A1');
  });
});
