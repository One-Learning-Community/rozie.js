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
import { render, fireEvent, screen, act } from '@testing-library/react';
import { useRef, useState } from 'react';
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
