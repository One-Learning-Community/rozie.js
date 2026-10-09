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
  AVAILABLE_WIDTH_PROPERTY,
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
  it('W1 defaults to offset → flip → shift → size (no arrow)', () => {
    const mw = buildMiddleware(factories, base);
    expect(names(mw)).toEqual(['offset', 'flip', 'shift', 'size']);
  });

  it('threads the offset value into the offset middleware', () => {
    const mw = buildMiddleware(factories, { ...base, offset: 24 });
    expect(mw[0]).toEqual({ name: 'offset', value: 24 });
  });

  it('W2 drops flip when disableFlip is set', () => {
    const mw = buildMiddleware(factories, { ...base, disableFlip: true });
    expect(names(mw)).toEqual(['offset', 'shift', 'size']);
  });

  it('W2 drops shift AND the trailing width-limit size when disableShift is set', () => {
    const mw = buildMiddleware(factories, { ...base, disableShift: true });
    expect(names(mw)).toEqual(['offset', 'flip']);
  });

  it('drops both flip and shift, keeping only offset', () => {
    const mw = buildMiddleware(factories, { ...base, disableFlip: true, disableShift: true });
    expect(names(mw)).toEqual(['offset']);
  });

  it('W3 appends arrow LAST when arrow is on AND an element is present', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: true, arrowEl: fakeEl });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift', 'size', 'arrow']);
    expect((mw[mw.length - 1] as { element: Element }).element).toBe(fakeEl);
  });

  it('omits arrow when arrow is on but no element has mounted yet', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: true, arrowEl: null });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift', 'size']);
  });

  it('omits arrow when an element exists but arrow is off', () => {
    const mw = buildMiddleware(factories, { ...base, arrow: false, arrowEl: fakeEl });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift', 'size']);
  });

  it('drops the matchWidth size when matchWidth is false', () => {
    const mw = buildMiddleware(factories, { ...base, matchWidth: false });
    expect(names(mw)).toEqual(['offset', 'flip', 'shift', 'size']);
  });

  it('W4 inserts size after offset, before flip/shift when matchWidth is true', () => {
    const mw = buildMiddleware(factories, { ...base, matchWidth: true });
    expect(names(mw)).toEqual(['offset', 'size', 'flip', 'shift', 'size']);
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

// 261008-mmt — the trailing width-limit size publishes the measured available width
// as a custom property; it writes nothing else (D-12: width only).
describe('buildMiddleware width-limit size', () => {
  const widthApply = () => {
    const mw = buildMiddleware(factories, base);
    return (mw[mw.length - 1] as { apply: (args: unknown) => void }).apply;
  };
  const recordingFloating = () => {
    const props = new Map<string, string>();
    const writes: string[] = [];
    const style = {
      setProperty: (name: string, value: string) => {
        writes.push(name);
        props.set(name, value);
      },
      getPropertyValue: (name: string) => props.get(name) ?? '',
      removeProperty: (name: string) => void props.delete(name),
    };
    return { floating: { style } as unknown as HTMLElement, props, writes };
  };

  it('W5 writes the floored available width under the exported property name', () => {
    expect(AVAILABLE_WIDTH_PROPERTY).toBe('--rozie-popover-available-width');
    const apply = widthApply();
    const { floating, props, writes } = recordingFloating();
    apply({ availableWidth: 389.7, elements: { floating } });
    expect(props.get(AVAILABLE_WIDTH_PROPERTY)).toBe('389px');
    // a second call with the same width does not write again
    apply({ availableWidth: 389.7, elements: { floating } });
    expect(writes).toEqual([AVAILABLE_WIDTH_PROPERTY]);
    // only the one custom property: never width / height / max-height
    expect([...props.keys()]).toEqual([AVAILABLE_WIDTH_PROPERTY]);
  });

  it('W5 clamps a negative width at 0px and rewrites when the width changes', () => {
    const apply = widthApply();
    const { floating, props, writes } = recordingFloating();
    apply({ availableWidth: -12, elements: { floating } });
    expect(props.get(AVAILABLE_WIDTH_PROPERTY)).toBe('0px');
    apply({ availableWidth: 300, elements: { floating } });
    expect(props.get(AVAILABLE_WIDTH_PROPERTY)).toBe('300px');
    expect(writes).toHaveLength(2);
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

  // shift is keyed on the CURRENT (post-flip) placement, not the initial one: after
  // flip falls a side placement back to bottom/top the cross axis is vertical and
  // sliding across it would push the panel over its own anchor (review finding A).
  it('U2 shift: crossAxis is on while the resolved placement is a side and off for vertical ones', () => {
    const optsFn = optionsOf('shift') as unknown as (state: {
      initialPlacement: string;
      placement: string;
    }) => unknown;
    expect(typeof optsFn).toBe('function');
    for (const placement of ['right-start', 'left-end', 'right', 'left']) {
      expect(optsFn({ initialPlacement: placement, placement })).toEqual({ crossAxis: true });
    }
    for (const placement of ['bottom', 'top-start', 'bottom-end']) {
      expect(optsFn({ initialPlacement: placement, placement })).toEqual({ crossAxis: false });
    }
    // flip fell back from a side placement to below/above: crossAxis goes off again
    for (const placement of ['bottom-start', 'top-end']) {
      expect(optsFn({ initialPlacement: 'right-start', placement })).toEqual({ crossAxis: false });
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

  // Review finding A: once flip has fallen back from a side placement to bottom/top,
  // the cross axis is VERTICAL, so shift's crossAxis would push a panel that overflows
  // the viewport bottom up over its own anchor. A bottom/top dropdown must not do that.
  it('E5b S7b: narrow AND short — a side placement that falls back to bottom does not cover the anchor', async () => {
    const scene: Scene = {
      viewport: { width: 390, height: 300 },
      ref: { x: 105, y: 20, width: 48, height: 40 },
      floating: { width: 360, height: 270 },
      placement: 'right-start',
    };
    const r = await place(scene, builderStack());
    expect(r.placement.startsWith('bottom') || r.placement.startsWith('top')).toBe(true);
    const refRight = scene.ref.x + scene.ref.width;
    const refBottom = scene.ref.y + scene.ref.height;
    const overlaps =
      r.left < refRight && r.right > scene.ref.x && r.top < refBottom && r.bottom > scene.ref.y;
    expect(overlaps).toBe(false);
    // still contained horizontally
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

describe('width limit against the real Floating UI engine', () => {
  it('W6 a 460px panel on the reported scene is capped to the viewport: 390px written, inside', async () => {
    const r = await place({ ...reported, floating: { width: 460, height: 220 } }, builderStack());
    expect(r.written).toBe('390px');
    expect(r.width).toBe(390);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
  });

  it('W7 the same size with a vertical placement gives the same outcome', async () => {
    const r = await place(
      { ...reported, floating: { width: 460, height: 220 }, placement: 'bottom' },
      builderStack(),
    );
    expect(r.written).toBe('390px');
    expect(r.width).toBe(390);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
  });

  it('W8 with shift on the value written is the FULL clipping width, not the room beside the anchor', async () => {
    const desktop = { width: 1280, height: 720 };
    const side = await place(
      {
        viewport: desktop,
        ref: { x: 300, y: 200, width: 120, height: 40 },
        floating: { width: 360, height: 220 },
        placement: 'right-start',
      },
      builderStack(),
    );
    expect(side.written).toBe('1280px');
    const vertical = await place(
      {
        viewport: desktop,
        ref: { x: 1200, y: 40, width: 40, height: 30 },
        floating: { width: 220, height: 300 },
        placement: 'bottom-end',
      },
      builderStack(),
    );
    expect(vertical.written).toBe('1280px');
  });

  it('W9 disableShift writes no width measurement', async () => {
    const r = await place(reported, builderStack({ disableShift: true }));
    expect(r.written).toBeUndefined();
  });
});
