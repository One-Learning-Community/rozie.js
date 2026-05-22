/**
 * Plan 04-04 Task 1 — useControllableState behaviour tests.
 *
 * Covers controlled / uncontrolled / parent-flip / functional-updater modes
 * per D-56 + D-57 + ROZ550.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { useControllableState } from '../useControllableState.js';

interface HarnessProps {
  value?: number;
  defaultValue: number;
  onValueChange?: (next: number) => void;
  /** Out-param: the harness writes the latest setValue into this ref so tests can call it. */
  setterOut: { current: ((next: number | ((prev: number) => number)) => void) | null };
  /** Out-param: the harness writes the latest currentValue into this ref. */
  valueOut: { current: number | null };
}

function Harness({ value, defaultValue, onValueChange, setterOut, valueOut }: HarnessProps) {
  const [v, setV] = useControllableState<number>({ value, defaultValue, onValueChange });
  setterOut.current = setV;
  valueOut.current = v;
  return <span>{v}</span>;
}

describe('useControllableState (Plan 04-04 Task 1 / D-56)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('Test 1 — controlled: setValue calls onValueChange but does NOT update local', () => {
    const onValueChange = vi.fn();
    const setter = { current: null as ((n: number | ((p: number) => number)) => void) | null };
    const valueOut = { current: null as number | null };
    render(
      <Harness value={5} defaultValue={0} onValueChange={onValueChange} setterOut={setter} valueOut={valueOut} />,
    );

    expect(valueOut.current).toBe(5);
    act(() => {
      setter.current!(6);
    });
    expect(onValueChange).toHaveBeenCalledWith(6);
    // Component still shows 5 because parent hasn't updated value yet.
    expect(valueOut.current).toBe(5);
  });

  it('Test 2 — uncontrolled: setValue updates internal state', () => {
    const setter = { current: null as ((n: number | ((p: number) => number)) => void) | null };
    const valueOut = { current: null as number | null };
    render(<Harness defaultValue={5} setterOut={setter} valueOut={valueOut} />);

    expect(valueOut.current).toBe(5);
    act(() => {
      setter.current!(6);
    });
    expect(valueOut.current).toBe(6);
  });

  it('Test 3 — parent-flip uncontrolled→controlled: ROZ550 warn fires once, follows new value', () => {
    const setter = { current: null as ((n: number | ((p: number) => number)) => void) | null };
    const valueOut = { current: null as number | null };
    const { rerender } = render(<Harness defaultValue={5} setterOut={setter} valueOut={valueOut} />);
    expect(valueOut.current).toBe(5);
    expect(warnSpy).not.toHaveBeenCalled();

    rerender(<Harness value={10} defaultValue={5} setterOut={setter} valueOut={valueOut} />);
    expect(valueOut.current).toBe(10);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toContain('[ROZ550]');
  });

  // Quick task 260521-qsh — close the controlled→uncontrolled flip branch
  // (the opposite direction of Test 3): covers the `? 'controlled'` true-arm
  // and the `: 'uncontrolled'` false-arm of the ROZ550 warn message.
  it('Test 3b — parent-flip controlled→uncontrolled: ROZ550 warn fires once, follows uncontrolled value', () => {
    const setter = { current: null as ((n: number | ((p: number) => number)) => void) | null };
    const valueOut = { current: null as number | null };
    const { rerender } = render(
      <Harness value={10} defaultValue={5} setterOut={setter} valueOut={valueOut} />,
    );
    expect(valueOut.current).toBe(10);
    expect(warnSpy).not.toHaveBeenCalled();

    // Rerender WITHOUT `value` — controlled → uncontrolled.
    rerender(<Harness defaultValue={5} setterOut={setter} valueOut={valueOut} />);
    // Now follows the uncontrolled value (the defaultValue-seeded local state).
    expect(valueOut.current).toBe(5);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toContain('[ROZ550]');
    expect(String(warnSpy.mock.calls[0]![0])).toContain(
      'from controlled to uncontrolled',
    );
  });

  // Quick task 260521-qsh — exercise the `onValueChange?.(...)` absent-callback
  // optional-chaining arm: an uncontrolled setValue with NO onValueChange prop.
  it('Test 2b — uncontrolled with no onValueChange: setValue updates state without throwing', () => {
    const setter = { current: null as ((n: number | ((p: number) => number)) => void) | null };
    const valueOut = { current: null as number | null };
    render(<Harness defaultValue={1} setterOut={setter} valueOut={valueOut} />);
    expect(valueOut.current).toBe(1);
    act(() => {
      setter.current!(2);
    });
    expect(valueOut.current).toBe(2);
  });

  it('Test 4a — functional updater (uncontrolled): setValue(prev => prev + 1) increments local', () => {
    const setter = { current: null as ((n: number | ((p: number) => number)) => void) | null };
    const valueOut = { current: null as number | null };
    render(<Harness defaultValue={5} setterOut={setter} valueOut={valueOut} />);
    act(() => {
      setter.current!((prev) => prev + 1);
    });
    expect(valueOut.current).toBe(6);
  });

  it('Test 4b — functional updater (controlled): calls onValueChange with computed next', () => {
    const onValueChange = vi.fn();
    const setter = { current: null as ((n: number | ((p: number) => number)) => void) | null };
    const valueOut = { current: null as number | null };
    render(
      <Harness value={5} defaultValue={0} onValueChange={onValueChange} setterOut={setter} valueOut={valueOut} />,
    );
    act(() => {
      setter.current!((prev) => prev + 1);
    });
    expect(onValueChange).toHaveBeenCalledWith(6);
    // Local view still shows 5 (parent hasn't updated).
    expect(valueOut.current).toBe(5);
  });
});
