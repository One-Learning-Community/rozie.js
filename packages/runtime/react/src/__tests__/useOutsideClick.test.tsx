/**
 * Plan 04-04 Task 1 — useOutsideClick behaviour tests.
 *
 * Covers MOD-04 (fires only when target is outside ALL listed refs),
 * `when:false` gating, and cleanup on unmount.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useOutsideClick } from '../useOutsideClick.js';

interface HarnessProps {
  callback: (e: MouseEvent) => void;
  when?: () => boolean;
  refCount?: 1 | 2 | 3;
  /** Out-params so the test can dispatch on the underlying DOM nodes. */
  outerOut: { current: HTMLDivElement | null };
  innerARefOut: { current: HTMLDivElement | null };
  innerBRefOut?: { current: HTMLDivElement | null };
  innerCRefOut?: { current: HTMLDivElement | null };
}

function Harness({
  callback,
  when,
  refCount = 1,
  outerOut,
  innerARefOut,
  innerBRefOut,
  innerCRefOut,
}: HarnessProps) {
  const a = useRef<HTMLDivElement | null>(null);
  const b = useRef<HTMLDivElement | null>(null);
  const c = useRef<HTMLDivElement | null>(null);
  const refs =
    refCount === 1
      ? [a]
      : refCount === 2
        ? [a, b]
        : [a, b, c];
  useOutsideClick(refs, callback, when);
  return (
    <div data-testid="outer" ref={outerOut as React.RefObject<HTMLDivElement>}>
      <div
        data-testid="a"
        ref={(el) => {
          a.current = el;
          innerARefOut.current = el;
        }}
      >
        inside-a
      </div>
      {refCount >= 2 && (
        <div
          data-testid="b"
          ref={(el) => {
            b.current = el;
            if (innerBRefOut) innerBRefOut.current = el;
          }}
        >
          inside-b
        </div>
      )}
      {refCount >= 3 && (
        <div
          data-testid="c"
          ref={(el) => {
            c.current = el;
            if (innerCRefOut) innerCRefOut.current = el;
          }}
        >
          inside-c
        </div>
      )}
    </div>
  );
}

describe('useOutsideClick (Plan 04-04 Task 1 / MOD-04)', () => {
  it('Test 5 — happy path: click outside fires; click inside does not', () => {
    const cb = vi.fn();
    const outer = { current: null as HTMLDivElement | null };
    const innerA = { current: null as HTMLDivElement | null };
    render(<Harness callback={cb} outerOut={outer} innerARefOut={innerA} />);

    // Click inside the listed ref → no fire
    fireEvent.click(innerA.current!);
    expect(cb).not.toHaveBeenCalled();

    // Click on document.body (outside all refs) → fires
    fireEvent.click(document.body);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('Test 6 — when:false gates the callback (no fire even on outside click)', () => {
    const cb = vi.fn();
    const outer = { current: null as HTMLDivElement | null };
    const innerA = { current: null as HTMLDivElement | null };
    render(<Harness callback={cb} when={() => false} outerOut={outer} innerARefOut={innerA} />);

    fireEvent.click(document.body);
    expect(cb).not.toHaveBeenCalled();
  });

  it('Test 7 — MOD-04 multi-ref: fires only when outside ALL three refs', () => {
    const cb = vi.fn();
    const outer = { current: null as HTMLDivElement | null };
    const a = { current: null as HTMLDivElement | null };
    const b = { current: null as HTMLDivElement | null };
    const c = { current: null as HTMLDivElement | null };
    render(
      <Harness
        callback={cb}
        refCount={3}
        outerOut={outer}
        innerARefOut={a}
        innerBRefOut={b}
        innerCRefOut={c}
      />,
    );

    fireEvent.click(a.current!);
    fireEvent.click(b.current!);
    fireEvent.click(c.current!);
    expect(cb).not.toHaveBeenCalled();

    fireEvent.click(document.body);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cleanup on unmount removes the document listener', () => {
    const cb = vi.fn();
    const outer = { current: null as HTMLDivElement | null };
    const a = { current: null as HTMLDivElement | null };
    const { unmount } = render(<Harness callback={cb} outerOut={outer} innerARefOut={a} />);

    fireEvent.click(document.body);
    expect(cb).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.click(document.body);
    // Still 1 — listener was removed
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // Quick task 260521-qsh — close the `if (!target) return` null-target branch.
  it('Test 8 — null event target: the handler short-circuits without firing', () => {
    const cb = vi.fn();
    const outer = { current: null as HTMLDivElement | null };
    const a = { current: null as HTMLDivElement | null };
    render(<Harness callback={cb} outerOut={outer} innerARefOut={a} />);

    // A real browser never produces a click with a null target, but the
    // defensive guard exists — drive it by forcing `target` to null on a
    // capture-phase click dispatched at the document.
    const evt = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: null, configurable: true });
    document.dispatchEvent(evt);
    expect(cb).not.toHaveBeenCalled();
  });

  it('stale-closure defense: when prop changes, latest closure runs (D-61)', () => {
    let captured = 0;
    const outer = { current: null as HTMLDivElement | null };
    const a = { current: null as HTMLDivElement | null };

    function Wrapper({ x }: { x: number }) {
      const cb = (_e: MouseEvent) => {
        captured = x;
      };
      return <Harness callback={cb} outerOut={outer} innerARefOut={a} />;
    }
    const { rerender } = render(<Wrapper x={1} />);
    rerender(<Wrapper x={42} />);

    fireEvent.click(document.body);
    expect(captured).toBe(42);
  });
});
