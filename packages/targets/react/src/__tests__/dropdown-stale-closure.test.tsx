/**
 * Plan 04-04 success criterion 1 — D-61 marquee anchor.
 *
 * Verify that when `<Dropdown>` is mounted with `open={false}` and then
 * re-rendered with `open={true}`, a subsequent document.click outside both
 * refs fires `close` with the LATEST closure value (not stale) — the
 * defining stale-closure test from RESEARCH Pitfall 1.
 *
 * The mechanism under test: useOutsideClick stores the callback + when
 * predicate in refs that update on every render. The internal document
 * handler reads `ref.current` so it sees fresh values.
 *
 * Plus a quick path-1 verification: with `open={true}` from the start,
 * clicking outside fires the callback (sanity check that the helper wires
 * the document listener correctly).
 */
import { describe, it, expect, vi } from 'vitest';
import { act, render, fireEvent } from '@testing-library/react';
import Dropdown from '../../tests/integration/Dropdown.compiled.js';

describe('Dropdown stale-closure correctness (Plan 04-04 success criterion 1)', () => {
  it('happy path — open=true from start, click outside fires onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(
      <Dropdown open={true} onOpenChange={onOpenChange}>
        {({ close }) => <div onClick={close}>panel</div>}
      </Dropdown>,
    );
    fireEvent.click(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stale-closure defense — parent rerenders open=false→true, click sees latest value (D-61)', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Dropdown open={false} onOpenChange={onOpenChange}>
        {({ close }) => <div onClick={close}>panel</div>}
      </Dropdown>,
    );
    // Initial click outside — open is false, when() returns false → no fire.
    fireEvent.click(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();

    // Parent flips open to true; document handler should now see latest value
    // via ref-storage in useOutsideClick.
    rerender(
      <Dropdown open={true} onOpenChange={onOpenChange}>
        {({ close }) => <div onClick={close}>panel</div>}
      </Dropdown>,
    );
    fireEvent.click(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Exactly one call — the post-rerender one (the pre-rerender click was gated).
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('cleanup on unmount — document listener removed, no fires after unmount', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Dropdown open={true} onOpenChange={onOpenChange}>
        {({ close }) => <div onClick={close}>panel</div>}
      </Dropdown>,
    );
    fireEvent.click(document.body);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.click(document.body);
    expect(onOpenChange).toHaveBeenCalledTimes(1); // no additional call
  });

  it('escape-key listener fires close when open + closeOnEscape (Class A path)', () => {
    const onOpenChange = vi.fn();
    render(
      <Dropdown open={true} onOpenChange={onOpenChange}>
        {({ close }) => <div onClick={close}>panel</div>}
      </Dropdown>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
