/**
 * middleware.test.ts — unit tests for the branchy Floating UI middleware builder.
 *
 * Two layers:
 *   1. Ordering / opt-out / opt-in branches with tagged stand-in factories (no real
 *      engine), including the option FUNCTIONS handed to flip and shift.
 *   2. An engine-backed describe that runs the real `@floating-ui/dom` math through a
 *      rect-only platform, on the geometry reported in 261008-mmt (a `right-start`
 *      panel on a 390px viewport). This is what proves the stack actually keeps the
 *      panel in view, and that vertical placements resolve exactly as the plain
 *      engine defaults do.
 *
 * Excluded from the vendored leaf copy (codegen's copyInternal drops `*.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { computePosition, offset, flip, shift, arrow, size } from '@floating-ui/dom';
import type { Middleware, Placement, Platform } from '@floating-ui/dom';
import {
  buildMiddleware,
  isSidePlacement,
  type MiddlewareFactories,
  type MiddlewareConfig,
} from './middleware';

const factories: MiddlewareFactories = {
  offset: (value) => ({ name: 'offset', value }),
  flip: (options) => ({ name: 'flip', options }),
  shift: (options) => ({ name: 'shift', options }),
  arrow: (opts) => ({ name: 'arrow', element: opts.element }),
  size: (opts) => ({ name: 'size', ...opts }),
};

const names = (mw: unknown[]) => mw.map((m) => (m as { name: string }).name);

const base: MiddlewareConfig = {
  offset: 8,
  disableFlip: false,
  disableShift: false,
  arrow: false,
  arrowEl: null,
  matchWidth: false,
};

const fakeEl = {} as Element;

describe('buildMiddleware', () => {
  it('defaults to offset → flip → shift (no arrow)', () => {
    const mw = buildMiddleware(factories, base);
    expect(names(mw)).toEqual(['offset', 'flip', 'shift']);
  });

  it('threads the offset value into the offset middleware', () => {
    const mw = buildMiddleware(factories, { ...base, offset: 24 });
    expect(mw[0]).toEqual({ name: 'offset', value: 24 });
  });

  it('drops flip when disableFlip is set', () => {
    const mw = buildMiddleware(factories, { ...base, disableFlip: true });
    expect(names(mw)).toEqual(['offset', 'shift']);
  });

  it('drops shift when disableShift is set', () => {
    const mw = buildMiddleware(factories, { ...base, disableShift: true });
    expect(names(mw)).toEqual(['offset', 'flip']);
  });

  it('drops both flip and shift, keeping only offset', () => {
    const mw = buildMiddleware(factories, { ...base, disableFlip: true, disableShift: true });
    expect(names(mw)).toEqual(['offset']);
  });

  it('appends arrow LAST when arrow is on AND an element is present', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: true, arrowEl: fakeEl });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift', 'arrow']);
    expect((mw[mw.length - 1] as { element: Element }).element).toBe(fakeEl);
  });

  it('omits arrow when arrow is on but no element has mounted yet', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: true, arrowEl: null });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift']);
  });

  it('omits arrow when an element exists but arrow is off', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: false, arrowEl: fakeEl });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift']);
  });

  it('drops size when matchWidth is false', () => {
    const mw = buildMiddleware(factories, { ...base, matchWidth: false });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift']);
  });

  it('inserts size after offset, before flip/shift when matchWidth is true', () => {
    const mw = buildMiddleware(factories, { ...base, matchWidth: true });
    expect(names(mw)).toEqual(['offset', 'size', 'flip', 'shift']);
  });

  // Release-0.8.0 audit B4: the size `apply` copies the reference width, but a
  // zero-width reference (a point virtual element) has none to match.
  it('size apply copies a positive reference width and leaves a zero-width one unset', () => {
    const mw = buildMiddleware(factories, { ...base, matchWidth: true });
    const apply = (mw[1] as { apply: (args: unknown) => void }).apply;
    const floating = { style: { width: '' } } as unknown as HTMLElement;
    apply({ rects: { reference: { width: 240 } }, elements: { floating } });
    expect(floating.style.width).toBe('240px');
    apply({ rects: { reference: { width: 0 } }, elements: { floating } });
    expect(floating.style.width).toBe('');
  });

  it('keeps size at index 1 even with disableFlip and disableShift both set', () => {
    const mw = buildMiddleware(factories, { ...base, matchWidth: true, disableFlip: true, disableShift: true });
    expect(names(mw)).toEqual(['offset', 'size']);
  });
});

// 261008-mmt — flip and shift receive OPTION FUNCTIONS keyed on the engine's own
// `initialPlacement`, so left/right placements get the below/above fallback and the
// cross-axis shift while top/bottom placements keep the engine defaults.
describe('buildMiddleware flip/shift option functions', () => {
  const optionsOf = (name: 'flip' | 'shift') => {
    const mw = buildMiddleware(factories, base);
    const entry = mw.find((m) => (m as { name: string }).name === name) as {
      options: (state: { initialPlacement: string }) => unknown;
    };
    return entry.options;
  };

  it('U1 flip: side placements get the alignment-only cross-axis check and the end fallback', () => {
    const opts = optionsOf('flip');
    expect(typeof opts).toBe('function');
    for (const initialPlacement of ['right-start', 'left-end', 'right', 'left']) {
      expect(opts({ initialPlacement })).toEqual({
        crossAxis: 'alignment',
        fallbackAxisSideDirection: 'end',
      });
    }
    for (const initialPlacement of ['bottom', 'top-start', 'bottom-end']) {
      expect(opts({ initialPlacement })).toEqual({});
    }
  });

  it('U2 shift: crossAxis is on for side placements and off for vertical ones', () => {
    const opts = optionsOf('shift');
    expect(typeof opts).toBe('function');
    for (const initialPlacement of ['right-start', 'left-end', 'right', 'left']) {
      expect(opts({ initialPlacement })).toEqual({ crossAxis: true });
    }
    for (const initialPlacement of ['bottom', 'top-start', 'bottom-end']) {
      expect(opts({ initialPlacement })).toEqual({ crossAxis: false });
    }
  });

  it('U3 isSidePlacement is false for a non-string (placement is a loosely typed String prop)', () => {
    expect(isSidePlacement(undefined)).toBe(false);
    expect(isSidePlacement(null)).toBe(false);
    expect(isSidePlacement(42)).toBe(false);
    expect(isSidePlacement('right-start')).toBe(true);
    expect(isSidePlacement('left')).toBe(true);
    expect(isSidePlacement('bottom')).toBe(false);
    expect(isSidePlacement('top-end')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Engine-backed: the REAL @floating-ui/dom math on a rect-only platform.
// ---------------------------------------------------------------------------

// This typed assignment is what the package tsc checks: it is exactly the object
// every leaf passes to buildMiddleware.
const realFactories: MiddlewareFactories = { offset, flip, shift, arrow, size };

interface Scene {
  viewport: { width: number; height: number };
  ref: { x: number; y: number; width: number; height: number };
  floating: { width: number; height: number };
  placement: Placement;
}

/** A floating stand-in whose `style` records custom-property writes. */
function makeFloating() {
  const props = new Map<string, string>();
  const style = {
    setProperty: (name: string, value: string) => void props.set(name, value),
    getPropertyValue: (name: string) => props.get(name) ?? '',
    removeProperty: (name: string) => void props.delete(name),
    width: '',
  };
  return { style, props };
}

const AVAILABLE_WIDTH = '--rozie-popover-available-width';

function place(scene: Scene, middleware: unknown[]) {
  const floatingEl = makeFloating();
  // The platform caps the floating width to the value the width-limit size wrote,
  // the way the stylesheet's `max-width: min(..., var(--rozie-popover-available-width))`
  // does in a real browser.
  const dims = () => {
    const cap = floatingEl.props.get(AVAILABLE_WIDTH);
    const capPx = cap ? Number.parseFloat(cap) : Number.POSITIVE_INFINITY;
    return { width: Math.min(scene.floating.width, capPx), height: scene.floating.height };
  };
  const platform = {
    getElementRects: async () => ({
      reference: { ...scene.ref },
      floating: { x: 0, y: 0, ...dims() },
    }),
    getDimensions: async () => dims(),
    getClippingRect: async () => ({
      x: 0,
      y: 0,
      width: scene.viewport.width,
      height: scene.viewport.height,
    }),
  };
  return computePosition(
    { getBoundingClientRect: () => ({ ...scene.ref, left: scene.ref.x, top: scene.ref.y, right: scene.ref.x + scene.ref.width, bottom: scene.ref.y + scene.ref.height }) } as unknown as Element,
    floatingEl as unknown as HTMLElement,
    {
      placement: scene.placement,
      strategy: 'fixed',
      middleware: middleware as Middleware[],
      platform: platform as unknown as Platform,
    },
  ).then((r) => {
    const { width, height } = dims();
    return {
      placement: r.placement,
      left: Math.round(r.x),
      right: Math.round(r.x + width),
      top: Math.round(r.y),
      bottom: Math.round(r.y + height),
      width,
      written: floatingEl.props.get(AVAILABLE_WIDTH),
      style: floatingEl,
    };
  });
}

const plainStack = () => [offset(8), flip(), shift()];
const builderStack = (config: Partial<MiddlewareConfig> = {}) =>
  buildMiddleware(realFactories, { ...base, ...config });

// The reported scene: 390x844, chip x 105..153 y 300..360, 360x220 card, right-start.
const reported: Scene = {
  viewport: { width: 390, height: 844 },
  ref: { x: 105, y: 300, width: 48, height: 60 },
  floating: { width: 360, height: 220 },
  placement: 'right-start',
};

describe('buildMiddleware against the real Floating UI engine', () => {
  it('E1 control: the plain offset/flip/shift stack leaves the reported scene overflowing at right 521', async () => {
    const r = await place(reported, plainStack());
    expect(r.placement).toBe('right-start');
    expect(r.right).toBe(521);
  });

  it('E2 the builder stack brings the reported scene inside the viewport, below the reference', async () => {
    const r = await place(reported, builderStack());
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
    expect(r.top).toBeGreaterThanOrEqual(360);
    expect(r.placement.startsWith('bottom')).toBe(true);
  });

  it('E3 S9: a right-end panel near the bottom falls back ABOVE and is inside horizontally', async () => {
    const r = await place(
      { ...reported, ref: { x: 105, y: 700, width: 48, height: 60 }, placement: 'right-end' },
      builderStack(),
    );
    expect(r.placement.startsWith('top')).toBe(true);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
    expect(r.bottom).toBeLessThanOrEqual(700);
  });

  it('E4 S10: a left-start panel with no room on the left ends up inside, below the reference', async () => {
    const r = await place(
      { ...reported, ref: { x: 300, y: 300, width: 48, height: 60 }, placement: 'left-start' },
      builderStack(),
    );
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
    expect(r.top).toBeGreaterThanOrEqual(360);
  });

  it('E5 S7: narrow AND short — still inside the viewport (covering the reference is allowed)', async () => {
    const r = await place(
      {
        viewport: { width: 390, height: 300 },
        ref: { x: 105, y: 120, width: 48, height: 60 },
        floating: { width: 360, height: 260 },
        placement: 'right-start',
      },
      builderStack(),
    );
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
  });

  // The builder stack and the plain engine defaults must agree wherever the plain
  // defaults already did the right thing: roomy side placements, tall panels that
  // fit beside the anchor, and every vertical placement.
  const invariance: Array<[string, Scene]> = [
    ['S3 desktop right-start with room', {
      viewport: { width: 1280, height: 720 },
      ref: { x: 300, y: 200, width: 120, height: 40 },
      floating: { width: 360, height: 220 },
      placement: 'right-start',
    }],
    ['S4 desktop right-start flips to the left', {
      viewport: { width: 1280, height: 720 },
      ref: { x: 1100, y: 200, width: 120, height: 40 },
      floating: { width: 360, height: 220 },
      placement: 'right-start',
    }],
    ['S8 tall panel stays beside the anchor', {
      viewport: { width: 1280, height: 720 },
      ref: { x: 300, y: 400, width: 120, height: 40 },
      floating: { width: 360, height: 600 },
      placement: 'right-start',
    }],
    ['S5 short viewport bottom-start', {
      viewport: { width: 1280, height: 400 },
      ref: { x: 300, y: 180, width: 240, height: 36 },
      floating: { width: 240, height: 300 },
      placement: 'bottom-start',
    }],
    ['S6 narrow viewport bottom', {
      viewport: { width: 390, height: 844 },
      ref: { x: 105, y: 300, width: 48, height: 60 },
      floating: { width: 360, height: 220 },
      placement: 'bottom',
    }],
    ['S11 desktop bottom-end near the edge', {
      viewport: { width: 1280, height: 720 },
      ref: { x: 1200, y: 40, width: 40, height: 30 },
      floating: { width: 220, height: 300 },
      placement: 'bottom-end',
    }],
  ];
  for (const [label, scene] of invariance) {
    it(`E6 invariance — ${label}`, async () => {
      const plain = await place(scene, plainStack());
      const built = await place(scene, builderStack());
      expect({ p: built.placement, l: built.left, t: built.top }).toEqual({
        p: plain.placement,
        l: plain.left,
        t: plain.top,
      });
    });
  }
});
