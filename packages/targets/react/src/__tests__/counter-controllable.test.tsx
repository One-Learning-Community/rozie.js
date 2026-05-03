/**
 * Plan 04-04 success criterion 3 — REACT-T-03 anchor.
 *
 * Verify Counter's useControllableState integration end-to-end:
 *   - Controlled mode: parent passes value+onValueChange; setValue calls
 *     onValueChange but does NOT update local. Component reflects parent's
 *     value until parent updates.
 *   - Uncontrolled mode: parent passes defaultValue only; setValue updates
 *     internal state.
 *   - Parent-flip: emits ROZ550 console.warn once (stable prefix per D-63).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Counter from '../../tests/integration/Counter.compiled.js';

describe('Counter useControllableState (Plan 04-04 success criterion 3 / REACT-T-03)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('controlled mode — increment calls onValueChange but local stays at parent value', () => {
    const onValueChange = vi.fn();
    const { getByLabelText, getByTestId } = render(
      <Counter value={5} onValueChange={onValueChange} />,
    );
    expect(getByTestId('value').textContent).toBe('5');
    fireEvent.click(getByLabelText('Increment'));
    expect(onValueChange).toHaveBeenCalledWith(6);
    // Local view still 5 — parent hasn't updated value prop.
    expect(getByTestId('value').textContent).toBe('5');
  });

  it('uncontrolled mode — increment updates local state', () => {
    const { getByLabelText, getByTestId } = render(<Counter defaultValue={5} />);
    expect(getByTestId('value').textContent).toBe('5');
    fireEvent.click(getByLabelText('Increment'));
    expect(getByTestId('value').textContent).toBe('6');
    fireEvent.click(getByLabelText('Increment'));
    expect(getByTestId('value').textContent).toBe('7');
  });

  it('parent-flip uncontrolled→controlled emits ROZ550 console.warn once', () => {
    const { rerender } = render(<Counter defaultValue={0} />);
    expect(warnSpy).not.toHaveBeenCalled();
    rerender(<Counter value={42} />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toContain('[ROZ550]');
  });

  it('decrement respects min', () => {
    const { getByLabelText } = render(<Counter defaultValue={0} min={0} />);
    expect((getByLabelText('Decrement') as HTMLButtonElement).disabled).toBe(true);
  });

  it('increment respects max', () => {
    const { getByLabelText } = render(<Counter defaultValue={10} max={10} />);
    expect((getByLabelText('Increment') as HTMLButtonElement).disabled).toBe(true);
  });
});
