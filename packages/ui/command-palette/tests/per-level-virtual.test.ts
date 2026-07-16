/**
 * per-level-virtual.test.ts — the frame/helper-layer contract for
 * command-palette-per-level-virtual (18-prop surface: `virtual` /
 * `virtualMaxHeight` / `virtualEstimateRowHeight`).
 *
 * This is the deliverable that is unit-testable without a browser: it
 * proves the palette's level-stack THREADS the three virtual fields
 * per-level (push captures them, pop restores the root fallback). The DOM
 * windowing itself (the spacer/slice mechanics) is proven upstream by the
 * vendored combobox's own `virtual-flip.behavior.test.ts` (combobox-virtual-
 * reactivity, commits 6fd84251+afa0a7ec — FD-01 resolved) and by this
 * family's own VR spec (authored, batched at the mini-series end).
 *
 * Pure glue over internal/levelStack.ts — mirrors levelStack.test.ts's
 * style; no `.rozie` compile here (that's surface.test.ts's job).
 */
import { describe, it, expect } from 'vitest';
import { pushFrame, popFrame, currentFrame, type LevelFrame, type NavigableItem } from '../src/internal/levelStack';

// The `.rozie`-side accessor shapes (currentVirtual()/currentVirtualMaxHeight()/
// currentVirtualEstimateRowHeight()) mirrored here as plain functions over a
// (frame, rootProps) pair — the exact resolution CommandPalette.rozie performs,
// re-derived from currentFrame() so this test exercises the real fallback path
// without needing to compile the `.rozie` source.
const resolveVirtual = (frame: LevelFrame<NavigableItem> | null, rootVirtual: boolean) =>
  frame ? frame.virtual : rootVirtual === true;

const resolveVirtualMaxHeight = (frame: LevelFrame<NavigableItem> | null, rootMaxHeight: string | null) =>
  frame ? frame.virtualMaxHeight : rootMaxHeight;

const resolveVirtualEstimateRowHeight = (
  frame: LevelFrame<NavigableItem> | null,
  rootEstimate: number | null,
) => (frame ? frame.virtualEstimateRowHeight : rootEstimate);

describe('per-level virtual — frame/helper-layer contract (command-palette-per-level-virtual)', () => {
  it('(a) at root (empty stack) currentFrame is null → the accessor path falls back to the palette-level `virtual` prop', () => {
    const stack: LevelFrame[] = [];
    expect(currentFrame(stack)).toBeNull();
    expect(resolveVirtual(currentFrame(stack), true)).toBe(true);
    expect(resolveVirtual(currentFrame(stack), false)).toBe(false);
  });

  it('(b) after pushFrame(stack, {source, virtual:true}, q), the top frame virtual is true', () => {
    const item = { id: 'goto', label: 'Go to page…', source: (_q: string) => [], virtual: true };
    const stack = pushFrame([], item, '');
    const frame = currentFrame(stack);
    expect(frame).not.toBeNull();
    expect(frame?.virtual).toBe(true);
  });

  it('(c) after popFrame, the stack returns to root → currentFrame null → the accessor falls back to the root `virtual` prop', () => {
    const item = { id: 'goto', label: 'Go to page…', source: (_q: string) => [], virtual: true };
    const pushed = pushFrame([], item, '');
    const { stack: popped } = popFrame(pushed);
    expect(currentFrame(popped)).toBeNull();
    expect(resolveVirtual(currentFrame(popped), false)).toBe(false);
  });

  it('(d) a frame built from an item with `group` fields AND `virtual:true` still exposes `virtual:true` (flat-render caveat is combobox-side)', () => {
    const item = {
      id: 'goto',
      label: 'Go to page…',
      group: 'Navigation',
      source: (_q: string) => [],
      virtual: true,
    };
    expect(() => pushFrame([], item, '')).not.toThrow();
    const stack = pushFrame([], item, '');
    const frame = currentFrame(stack);
    expect(frame?.virtual).toBe(true);
  });

  it('(e) a frame pushed from a virtual item carries virtual:true PLUS its captured virtualMaxHeight/virtualEstimateRowHeight', () => {
    const item = {
      id: 'goto',
      label: 'Go to page…',
      source: (_q: string) => [],
      virtual: true,
      virtualMaxHeight: '320px',
      virtualEstimateRowHeight: 48,
    };
    const stack = pushFrame([], item, '');
    const frame = currentFrame(stack);
    expect(frame?.virtual).toBe(true);
    expect(frame?.virtualMaxHeight).toBe('320px');
    expect(frame?.virtualEstimateRowHeight).toBe(48);
    // The exact inputs `:max-height` / `:estimate-row-height` read — the
    // spacer/slice windowing mechanics themselves are combobox's own
    // virtual-flip.behavior.test.ts responsibility; this asserts the
    // palette flips the BINDING per-level.
    expect(resolveVirtualMaxHeight(frame, null)).toBe('320px');
    expect(resolveVirtualEstimateRowHeight(frame, 36)).toBe(48);
  });

  it('(f) popping back to a grouped non-virtual root restores the non-virtual (grouped) path', () => {
    const item = { id: 'goto', label: 'Go to page…', source: (_q: string) => [], virtual: true };
    const pushed = pushFrame([], item, '');
    const { stack: popped } = popFrame(pushed);
    // The root prop is false (non-virtual, grouped) — after popFrame to
    // empty, levelVirtual resolves to the root prop so combobox re-derives
    // groups (the per-level caveat, honestly bidirectional).
    expect(resolveVirtual(currentFrame(popped), false)).toBe(false);
  });

  it('(g) the per-item fields OVERRIDE the palette-level props for that level', () => {
    const item = {
      id: 'goto',
      label: 'Go to page…',
      source: (_q: string) => [],
      virtual: true,
      virtualMaxHeight: '320px',
      virtualEstimateRowHeight: 48,
    };
    const stack = pushFrame([], item, '');
    const frame = currentFrame(stack);
    // Root props deliberately set to DIFFERENT values than the frame's —
    // the frame values must win regardless.
    expect(resolveVirtual(frame, false)).toBe(true);
    expect(resolveVirtualMaxHeight(frame, '999px')).toBe('320px');
    expect(resolveVirtualEstimateRowHeight(frame, 12)).toBe(48);
  });
});
