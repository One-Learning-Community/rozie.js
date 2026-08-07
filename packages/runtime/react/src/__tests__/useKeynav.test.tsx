/**
 * Plan 71-04 Task 1 — `useKeynav` behavior tests.
 *
 * Every case from the plan's `<behavior>` block, asserted against a REAL
 * rendered DOM tree (not IR-shape-only — per `feedback_snapshot_tests_cement_bugs`
 * and SPEC §11's "behavior tests, not just snapshots" testing gate). The
 * `Menu` harness below hand-authors the JSX a compiled React `r-keynav`
 * component would emit (`data-rozie-keynav-item`/`data-rozie-keynav-active`/
 * `tabIndex` as DECLARATIVE bindings comparing the loop index to live
 * `active` state — see the module doc comment on `useKeynav.ts` for why the
 * hook itself never touches those two attributes).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, within, act, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import type { KeynavConfig, KeynavPageDetail } from '@rozie/runtime-keynav-core';
import { useKeynav } from '../useKeynav.js';

interface Item {
  id: string;
  label: string;
  disabled?: boolean;
}

const ITEMS: Item[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo', disabled: true },
  { id: 'c', label: 'Charlie' },
];

const BASE_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'vertical',
  loop: false,
  typeahead: true,
  skipDisabled: true,
};

function Menu({
  config,
  onCommit,
  activeClass,
  items = ITEMS,
}: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  activeClass?: string;
  items?: Item[];
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  useKeynav(rootRef, {
    config,
    getSource: () => items,
    getActive: () => active,
    setActive,
    onCommit,
    ...(activeClass !== undefined ? { activeClass } : {}),
  });
  return (
    <div role="menu" ref={rootRef} tabIndex={-1} data-testid="root">
      {items.map((it, i) => (
        <button
          type="button"
          key={it.id}
          role="menuitem"
          id={`menu-item-${i}`}
          data-rozie-keynav-item={i}
          data-rozie-keynav-active={active === i ? '' : undefined}
          tabIndex={active === i ? 0 : -1}
          disabled={it.disabled}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function isActive(el: HTMLElement): boolean {
  return el.getAttribute('data-rozie-keynav-active') === '';
}

describe('useKeynav (Plan 71-04 Task 1)', () => {
  it('ArrowDown moves active + stamps data-rozie-keynav-active on the next enabled item (skips disabled)', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowDown' });

    // Index 1 (Bravo) is disabled — skipDisabled lands on index 2 (Charlie).
    expect(isActive(screen.getByText('Charlie'))).toBe(true);
    expect(isActive(screen.getByText('Alpha'))).toBe(false);
    expect(isActive(screen.getByText('Bravo'))).toBe(false);
  });

  it('Home/End jump to first/last enabled; Enter invokes commit with the active index', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'End' });
    expect(isActive(screen.getByText('Charlie'))).toBe(true);

    fireEvent.keyDown(root, { key: 'Enter' });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(2);

    fireEvent.keyDown(root, { key: 'Home' });
    expect(isActive(screen.getByText('Alpha'))).toBe(true);
  });

  it('typeahead: typing a label prefix jumps to the matching item', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'c' });

    expect(isActive(screen.getByText('Charlie'))).toBe(true);
  });

  it('r-keynav-active-class tokens are added to the active item and removed from the previous one', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} activeClass="is-active" />);
    const root = screen.getByTestId('root');

    // The active-class effect fires on mount too (active starts at index 0).
    expect(screen.getByText('Alpha').classList.contains('is-active')).toBe(true);

    fireEvent.keyDown(root, { key: 'ArrowDown' });
    expect(screen.getByText('Charlie').classList.contains('is-active')).toBe(true);
    expect(screen.getByText('Alpha').classList.contains('is-active')).toBe(false);

    fireEvent.keyDown(root, { key: 'Home' });
    expect(screen.getByText('Alpha').classList.contains('is-active')).toBe(true);
    expect(screen.getByText('Charlie').classList.contains('is-active')).toBe(false);
  });

  it('tabindex model: the active item receives DOM focus + tabIndex 0, others tabIndex -1', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowDown' });
    const activeEl = screen.getByText('Charlie');

    expect(activeEl.getAttribute('tabindex')).toBe('0');
    expect(screen.getByText('Alpha').getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(activeEl);
  });

  it('pointer activation: pointerdown on an item sets active + fires commit (bounds-checked marker parse)', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);

    fireEvent.pointerDown(screen.getByText('Charlie'));

    expect(commit).toHaveBeenCalledWith(2);
    expect(isActive(screen.getByText('Charlie'))).toBe(true);
  });

  it('activedescendant model: no DOM focus movement (focus stays where the author put it)', () => {
    const commit = vi.fn();
    render(
      <Menu
        config={{ ...BASE_CONFIG, focusModel: 'activedescendant' }}
        onCommit={commit}
      />,
    );
    const root = screen.getByTestId('root');
    root.focus();

    fireEvent.keyDown(root, { key: 'ArrowDown' });

    expect(isActive(screen.getByText('Charlie'))).toBe(true);
    expect(document.activeElement).toBe(root);
  });
});

// ---------------------------------------------------------------------------
// Plan 260806-lz7 Task 1 — strict-containment focus guard. A `ScopedMenu`
// harness wires `getFocusScope` to a wrapper element that contains the
// keynav root PLUS a sibling "heading" (standing in for the date-picker
// drill heading), so cases (a)/(b) can distinguish "inside the component,
// outside the root" from "outside the component entirely."
// ---------------------------------------------------------------------------

function ScopedMenu({
  config,
  onCommit,
  items = ITEMS,
  showRoot = true,
}: {
  config: KeynavConfig;
  onCommit: (i: number) => void;
  items?: Item[];
  /** Mirrors an `r-if`-gated root — the wrapper/heading persist, the root re-mounts. */
  showRoot?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  useKeynav(rootRef, {
    config,
    getSource: () => items,
    getActive: () => active,
    setActive,
    onCommit,
    getFocusScope: () => [wrapperRef.current],
  });
  return (
    <div data-testid="wrapper" ref={wrapperRef}>
      <button type="button" data-testid="heading">
        Heading
      </button>
      {showRoot && (
        <div role="menu" ref={rootRef} tabIndex={-1} data-testid="root">
          {items.map((it, i) => (
            <button
              type="button"
              key={it.id}
              role="menuitem"
              data-rozie-keynav-item={i}
              data-rozie-keynav-active={active === i ? '' : undefined}
              tabIndex={active === i ? 0 : -1}
              disabled={it.disabled}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

describe('useKeynav — strict-containment focus guard (Plan 260806-lz7 Task 1)', () => {
  it('case (c): a cold mount with nothing ever focused does not steal focus or scroll', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);

    // Nothing has been focused anywhere on the page — happy-dom's initial
    // activeElement is document.body.
    expect(document.activeElement).toBe(document.body);
    expect(isActive(screen.getByText('Alpha'))).toBe(true); // active-class/data marker IS unconditional
    expect(document.activeElement).not.toBe(screen.getByText('Alpha')); // but DOM focus was NOT stolen
  });

  it('case (a) — THE STRICTNESS CASE: mount while a real element OUTSIDE the component subtree holds focus does not steal focus', () => {
    const commit = vi.fn();
    render(<button type="button" data-testid="outside">Outside</button>);
    screen.getByTestId('outside').focus();
    expect(document.activeElement).toBe(screen.getByTestId('outside'));

    render(<ScopedMenu config={BASE_CONFIG} onCommit={commit} />);

    // A document-scoped predicate would let this steal focus (something IS
    // focused on the page); strict containment must not, because "outside"
    // is not inside the ScopedMenu's wrapper.
    expect(document.activeElement).toBe(screen.getByTestId('outside'));
    expect(document.activeElement).not.toBe(screen.getByText('Alpha'));
  });

  it('case (b): mount/re-appearance while focus is INSIDE the component but outside the keynav root DOES focus (drill-continuity shape)', () => {
    const commit = vi.fn();
    const { rerender } = render(
      <ScopedMenu config={BASE_CONFIG} onCommit={commit} showRoot={false} />,
    );
    screen.getByTestId('heading').focus();
    expect(document.activeElement).toBe(screen.getByTestId('heading'));

    // The root re-appears (mirrors an r-if-gated panel re-entering) while
    // focus sits on the heading, which is inside the wrapper scope.
    rerender(<ScopedMenu config={BASE_CONFIG} onCommit={commit} showRoot={true} />);

    expect(document.activeElement).toBe(screen.getByText('Alpha'));
  });

  it('case (d): after a guarded cold mount, an index change focuses unconditionally even though document focus is still at body', () => {
    const commit = vi.fn();
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);
    const root = screen.getByTestId('root');
    expect(document.activeElement).toBe(document.body); // guarded mount pass did not steal focus

    fireEvent.keyDown(root, { key: 'ArrowDown' }); // a genuine navigation pass

    // Bravo is disabled — skipDisabled lands on Charlie — and it IS focused,
    // unconditionally, even though document focus was still at body.
    expect(document.activeElement).toBe(screen.getByText('Charlie'));
  });

  it('compatibility: without getFocusScope, a real focus anywhere in the document still lets the guarded first pass focus (document-scoped fallback, never unconditional steal)', () => {
    const commit = vi.fn();
    render(<button type="button" data-testid="outside">Outside</button>);
    screen.getByTestId('outside').focus();

    // `Menu` (unlike `ScopedMenu`) never passes `getFocusScope` — this
    // proves the field is additive and an un-regenerated leaf degrades to
    // the OLD document-scoped predicate, not to a hard rejection.
    render(<Menu config={BASE_CONFIG} onCommit={commit} />);

    expect(document.activeElement).toBe(screen.getByText('Alpha'));
  });

  // -------------------------------------------------------------------------
  // Found via this plan's own Docker VR run against @rozie-ui/date-picker:
  // a consumer may resolve its TRUE mount-time active index through an
  // app-level effect that writes `setActive` AFTER the initial render (e.g.
  // date-picker's `seedActiveDay`, deliberately deferred one
  // `requestAnimationFrame` for unrelated reactive-commit-timing reasons —
  // see `DatePicker.rozie`'s own doc comment on `seedActiveDay`). From
  // `useKeynav`'s point of view this looks EXACTLY like two passes with
  // different `active` values — indistinguishable from a real keyboard/
  // pointer navigation on a plain value diff. Without gating `isNavigationPass`
  // on a REAL delegated DOM interaction (keydown/pointerdown/focusin) having
  // occurred, the second (deferred) pass would incorrectly qualify as
  // "navigation" and focus unconditionally — stealing focus on a page where
  // NOTHING was ever interacted with, exactly the case (c)/(a) cold-mount
  // guarantee this whole plan exists to establish. `DeferredSeedMenu` below
  // reproduces the two-pass shape directly (no fake timers — a real
  // `useEffect` write after mount, mirroring the app-level `$onMount` write
  // date-picker performs, still not routed through any DOM event).
  // -------------------------------------------------------------------------
  it('an app-level (non-interaction) active-index write AFTER mount is still guarded — a value change alone is not evidence of a real navigation', async () => {
    const commit = vi.fn();

    function DeferredSeedMenu() {
      const rootRef = useRef<HTMLDivElement | null>(null);
      const [active, setActive] = useState(0);
      useKeynav(rootRef, {
        config: BASE_CONFIG,
        getSource: () => ITEMS,
        getActive: () => active,
        setActive,
        onCommit: commit,
      });
      // Mirrors date-picker's `seedActiveDay`: an APP-LEVEL effect (never a
      // keydown/pointerdown/focusin) resolves the true active index after
      // the initial render — here synchronously post-mount rather than via
      // requestAnimationFrame, since the exact deferral mechanism is not
      // what's under test; only "a setActive call that never went through a
      // delegated DOM event" is.
      useEffect(() => {
        setActive(2); // 'Charlie' — a DIFFERENT index than the initial 0.
      }, []);
      return (
        <div role="menu" ref={rootRef} tabIndex={-1} data-testid="root">
          {ITEMS.map((it, i) => (
            <button
              type="button"
              key={it.id}
              role="menuitem"
              data-rozie-keynav-item={i}
              data-rozie-keynav-active={active === i ? '' : undefined}
              tabIndex={active === i ? 0 : -1}
              disabled={it.disabled}
            >
              {it.label}
            </button>
          ))}
        </div>
      );
    }

    render(<DeferredSeedMenu />);
    await waitFor(() => expect(screen.getByText('Charlie').getAttribute('data-rozie-keynav-active')).toBe(''));

    // The active-class/data marker DID move to Charlie (index 2) — that's
    // the app's own state, unconditional per SPEC §9 — but DOM focus must
    // NOT have followed it, since nothing on the page was ever interacted
    // with.
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(screen.getByText('Charlie'));
  });
});

// ---------------------------------------------------------------------------
// Plan 77-03 Task 1 — `onPage` + `gridColumns` + the deferred one-frame-late
// focus pass. A separate harness (`GridMenu`) keeps the pre-existing `Menu`
// cases above completely untouched (SPEC §7.4 additive invariant).
// ---------------------------------------------------------------------------

const GRID_ITEMS: Item[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
  { id: 'e', label: 'E' },
  { id: 'f', label: 'F' },
];

// `orientation: 'both'` is what the 1D branch falls back to when `gridColumns`
// is NOT supplied — deliberately reused for both the grid and no-grid cases
// below so the harness proves grid semantics are selected by `gridColumns`
// PRESENCE alone, not by anything in `config` itself.
const GRID_CONFIG: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'both',
  loop: false,
  typeahead: false,
  skipDisabled: false,
};

function GridMenu({
  config,
  columns,
  onPage,
  onCommit,
  items = GRID_ITEMS,
}: {
  config: KeynavConfig;
  /** Omitted entirely to exercise the "no gridColumns" (1D) branch. */
  columns?: number | (() => number);
  onPage?: (detail: KeynavPageDetail) => void;
  onCommit: (i: number) => void;
  items?: Item[];
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  useKeynav(rootRef, {
    config,
    getSource: () => items,
    getActive: () => active,
    setActive,
    onCommit,
    ...(columns !== undefined
      ? { gridColumns: typeof columns === 'function' ? columns : () => columns }
      : {}),
    ...(onPage !== undefined ? { onPage } : {}),
  });
  return (
    <div role="grid" ref={rootRef} tabIndex={-1} data-testid="root">
      {items.map((it, i) => (
        <button
          type="button"
          key={it.id}
          role="gridcell"
          data-rozie-keynav-item={i}
          data-rozie-keynav-active={active === i ? '' : undefined}
          tabIndex={active === i ? 0 : -1}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// Harness for the "item renders one frame late" cases — item 5 is only
// present once the `revealed` prop flips, standing in for a dataset swap
// (grid paging) whose landing element isn't in the DOM at effect time yet.
function LateGrid({ revealed, onCommit }: { revealed: boolean; onCommit: (i: number) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  useKeynav(rootRef, {
    config: GRID_CONFIG,
    getSource: () => GRID_ITEMS,
    getActive: () => active,
    setActive,
    onCommit,
    gridColumns: () => 3,
  });
  return (
    <div role="grid" ref={rootRef} tabIndex={-1} data-testid="root">
      {GRID_ITEMS.map((it, i) =>
        i === 5 && !revealed ? null : (
          <button
            type="button"
            key={it.id}
            role="gridcell"
            data-rozie-keynav-item={i}
            data-rozie-keynav-active={active === i ? '' : undefined}
            tabIndex={active === i ? 0 : -1}
          >
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}

/** Stubs `requestAnimationFrame`/`cancelAnimationFrame` for manual, deterministic control. */
function stubRaf(): {
  callbacks: FrameRequestCallback[];
  cancelSpy: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const callbacks: FrameRequestCallback[] = [];
  const rafSpy = vi.fn((cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  });
  const cancelSpy = vi.fn();
  vi.stubGlobal('requestAnimationFrame', rafSpy);
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);
  return { callbacks, cancelSpy, restore: () => vi.unstubAllGlobals() };
}

describe('useKeynav — grid config, @keynav-page, deferred focus (Plan 77-03 Task 1)', () => {
  it('grid: onPage receives a boundary detail when an arrow hits the edge (SPEC §4.1)', () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    render(<GridMenu config={GRID_CONFIG} columns={3} onCommit={commit} onPage={onPage} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowLeft' }); // active starts at 0 -> row-axis boundary

    expect(onPage).toHaveBeenCalledWith({ direction: -1, reason: 'boundary', axis: 'row' });
    // The machine never lands on a boundary key (SPEC §4.1) — active unmoved.
    expect(screen.getByText('A').getAttribute('data-rozie-keynav-active')).toBe('');
  });

  it('grid: ArrowDown moves active by the column-stride count', () => {
    const commit = vi.fn();
    render(<GridMenu config={GRID_CONFIG} columns={3} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowDown' });

    expect(screen.getByText('D').getAttribute('data-rozie-keynav-active')).toBe('');
  });

  it('grid: a dynamic columns() getter changes the stride between keydowns without re-instantiating the machine', () => {
    const commit = vi.fn();
    const { rerender } = render(<GridMenu config={GRID_CONFIG} columns={3} onCommit={commit} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowDown' }); // stride 3: 0 -> 3 (D)
    expect(screen.getByText('D').getAttribute('data-rozie-keynav-active')).toBe('');

    // A fresh `columns` closure lands via a re-render — same mechanism a
    // reactive `$data.cols` read would exercise in emitted code.
    rerender(<GridMenu config={GRID_CONFIG} columns={2} onCommit={commit} />);
    fireEvent.keyDown(root, { key: 'ArrowDown' }); // stride 2: 3 -> 5 (F)

    expect(screen.getByText('F').getAttribute('data-rozie-keynav-active')).toBe('');
  });

  it('no gridColumns: the config handed to the machine has no grid key — 1D arrow semantics (±1), onPage never fires', () => {
    const commit = vi.fn();
    const onPage = vi.fn();
    render(<GridMenu config={GRID_CONFIG} onCommit={commit} onPage={onPage} />);
    const root = screen.getByTestId('root');

    fireEvent.keyDown(root, { key: 'ArrowDown' }); // 1D: ±1, NOT ±columns

    expect(screen.getByText('B').getAttribute('data-rozie-keynav-active')).toBe('');
    expect(onPage).not.toHaveBeenCalled();
  });

  it('grid: a one-frame-late item render still receives focus once it appears (T-77-03-03)', () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const { rerender } = render(<LateGrid revealed={false} onCommit={commit} />);
      const root = screen.getByTestId('root');

      fireEvent.keyDown(root, { key: 'End', ctrlKey: true }); // grid corner -> index 5, not yet rendered
      expect(screen.queryByText('F')).toBeNull();
      expect(raf.callbacks).toHaveLength(1);

      // The browser "paints" the newly-swapped dataset one frame later.
      rerender(<LateGrid revealed={true} onCommit={commit} />);
      const revealedEl = screen.getByText('F');
      expect(revealedEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).not.toBe(revealedEl);

      // Fire the deferred pass — the element exists now, so focus lands.
      act(() => {
        raf.callbacks[0]!(0);
      });
      expect(document.activeElement).toBe(revealedEl);
    } finally {
      raf.restore();
    }
  });

  it('grid: a stale deferred pass never steals focus after a newer navigation supersedes it (T-77-03-03)', () => {
    const raf = stubRaf();
    try {
      const commit = vi.fn();
      const { rerender } = render(<LateGrid revealed={false} onCommit={commit} />);
      const root = screen.getByTestId('root');

      // First navigation lands on the not-yet-rendered index 5 — schedules a
      // deferred pass scoped to active === 5.
      fireEvent.keyDown(root, { key: 'End', ctrlKey: true });
      expect(raf.callbacks).toHaveLength(1);
      const stalePass = raf.callbacks[0]!;

      // A second navigation (to an ALREADY-rendered item) supersedes it
      // before the deferred pass ever runs.
      fireEvent.keyDown(root, { key: 'Home', ctrlKey: true });
      const aEl = screen.getByText('A');
      expect(aEl.getAttribute('data-rozie-keynav-active')).toBe('');
      expect(document.activeElement).toBe(aEl);

      rerender(<LateGrid revealed={true} onCommit={commit} />);

      // The stale pass (still scoped to the superseded active === 5) fires —
      // it must no-op, never stealing focus back from the current item.
      act(() => {
        stalePass(0);
      });
      expect(document.activeElement).toBe(aEl);
    } finally {
      raf.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Quick task 260806-lz7 — drill-exit sibling-group race. Found via a REAL
// Chromium Docker VR run against @rozie-ui/date-picker's months->days
// Escape exit: the months panel's focused cell is destroyed by the SAME
// transition that resolves the days grid's (a SIBLING attachment sharing
// the SAME `getFocusScope` wrapper) guarded pass, but that pass's REAL
// value is itself deferred one `requestAnimationFrame` for reasons entirely
// unrelated to this guard (date-picker's own `seedActiveDay` — reactive-
// commit-timing, not focus). `@rozie/runtime-keynav-core`'s
// `focusIsWithinScope` tracks "the last element to lose focus via a
// same-tick DOM removal" and expires that tracking after a bounded number
// of animation frames so a genuinely later, unrelated interaction doesn't
// keep reusing it — but the tracker's OWN internal expiry
// `requestAnimationFrame` and the SIBLING's independently-registered
// deferred-write `requestAnimationFrame` are two UNRELATED registrations
// that can land in the SAME upcoming frame. On React specifically, the
// removal's `focusout` (and therefore the tracker's own expiry rAF)
// registers BEFORE the sibling's deferred write registers its own rAF —
// browsers run same-frame rAF callbacks in REGISTRATION order, so a
// single-frame expiry clears the tracker one frame before the sibling's
// real value ever lands. This harness reproduces that exact registration
// order with a stubbed, deterministic rAF queue.
// ---------------------------------------------------------------------------

function TwoGroupHarness({
  showB,
  activeA,
  onCommitA,
  onCommitB,
}: {
  showB: boolean;
  activeA: number;
  onCommitA: (i: number) => void;
  onCommitB: (i: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rootARef = useRef<HTMLDivElement | null>(null);
  const rootBRef = useRef<HTMLDivElement | null>(null);
  const [activeB] = useState(0);
  useKeynav(rootARef, {
    config: BASE_CONFIG,
    getSource: () => ITEMS,
    getActive: () => activeA,
    setActive: () => {},
    onCommit: onCommitA,
    getFocusScope: () => [wrapperRef.current],
  });
  useKeynav(rootBRef, {
    config: BASE_CONFIG,
    getSource: () => ITEMS,
    getActive: () => activeB,
    setActive: () => {},
    onCommit: onCommitB,
    getFocusScope: () => [wrapperRef.current],
  });
  return (
    <div data-testid="wrapper" ref={wrapperRef}>
      <div role="menu" ref={rootARef} tabIndex={-1} data-testid="rootA">
        {ITEMS.map((it, i) => (
          <button
            type="button"
            key={it.id}
            data-rozie-keynav-item={i}
            data-rozie-keynav-active={activeA === i ? '' : undefined}
            tabIndex={activeA === i ? 0 : -1}
          >
            {it.label}
          </button>
        ))}
      </div>
      {showB && (
        <div role="menu" ref={rootBRef} tabIndex={-1} data-testid="rootB">
          {ITEMS.map((it, i) => (
            <button
              type="button"
              key={it.id}
              data-rozie-keynav-item={i}
              data-rozie-keynav-active={activeB === i ? '' : undefined}
              tabIndex={activeB === i ? 0 : -1}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

describe('useKeynav — drill-exit sibling-group race (Plan 260806-lz7)', () => {
  it('a sibling group\'s focused item destroyed in the same transition, followed by a SEPARATELY rAF-deferred write for THIS group (mirroring date-picker\'s seedActiveDay), still focuses — even when the tracker\'s OWN internal expiry rAF is registered BEFORE the sibling\'s deferred-write rAF (the exact React drill-exit race, found via a real-Chromium Docker VR run)', () => {
    const raf = stubRaf();
    try {
      const commitA = vi.fn();
      const commitB = vi.fn();

      const { rerender } = render(
        <TwoGroupHarness showB={true} activeA={0} onCommitA={commitA} onCommitB={commitB} />,
      );

      // Focus lands on group B's active item (mirrors drilling into months —
      // group B's own first guarded pass focused it, since group B's item
      // was, at that point, the composed active element and thus "within
      // scope" via direct containment).
      const bItem = within(screen.getByTestId('rootB')).getByText('Alpha');
      act(() => {
        bItem.focus();
      });
      expect(document.activeElement).toBe(bItem);

      // The transition: group B's focused item is removed as part of a
      // real-Chromium-style same-tick DOM removal — dispatch the WHATWG
      // "unfocusing steps" `focusout` (relatedTarget null) BEFORE removal,
      // exactly like `focusGuard.test.ts`'s own `dispatchRemovalFocusOut`
      // (happy-dom does not fire this automatically). This registers the
      // tracker's OWN internal (chained) expiry rAF — callbacks[0].
      act(() => {
        bItem.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
      });
      rerender(<TwoGroupHarness showB={false} activeA={0} onCommitA={commitA} onCommitB={commitB} />);
      expect(document.activeElement).toBe(document.body);
      expect(raf.callbacks.length).toBeGreaterThanOrEqual(1);
      const trackerExpiryLink1 = raf.callbacks[0]!;

      // Group A's OWN sibling deferred write — mirrors `seedActiveDay`'s
      // `requestAnimationFrame(() => { $data.activeDay = next })`,
      // registered strictly AFTER the tracker's own expiry rAF above
      // (matching the exact registration order this fix depends on:
      // real-Chromium fires `focusout` — and therefore arms the tracker's
      // expiry — synchronously inside the transition's own handler, BEFORE
      // date-picker's `seedActiveDay` call that follows it even runs).
      let deferredWriteRan = false;
      requestAnimationFrame(() => {
        deferredWriteRan = true;
        rerender(<TwoGroupHarness showB={false} activeA={2} onCommitA={commitA} onCommitB={commitB} />);
      });
      const siblingDeferredWrite = raf.callbacks[raf.callbacks.length - 1]!;

      // Fire the tracker's own first chained expiry link — mirrors it
      // running BEFORE the sibling's deferred write in the SAME animation
      // frame (the race). With the fix, this must NOT clear the tracker
      // outright — it re-arms for a further frame.
      act(() => {
        trackerExpiryLink1(0);
      });

      // NOW the sibling's deferred write fires — group A's active index
      // resolves to 2 (Charlie), and its guarded pass must still see the
      // tracker as valid (group B's chain is still "within scope" via the
      // shared wrapper).
      act(() => {
        siblingDeferredWrite(0);
      });
      expect(deferredWriteRan).toBe(true);

      const aItem2 = within(screen.getByTestId('rootA')).getByText('Charlie');
      expect(document.activeElement).toBe(aItem2);
    } finally {
      raf.restore();
    }
  });
});
