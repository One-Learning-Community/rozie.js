// Behavior tests for the strict-containment focus guard — Plan 260806-lz7.
// Composed-tree ascent/descent through shadow DOM, and the pinned fallback
// semantics documented in focusGuard.ts's module comment.
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  composedActiveElement,
  composedContains,
  documentHasRealFocus,
  focusIsWithinScope,
} from '../focusGuard.js';

describe('composedActiveElement', () => {
  it('returns null when nothing has ever been focused (document.body is active)', () => {
    expect(composedActiveElement(document)).toBe(document.body);
  });

  it('returns the light-DOM focused element when there is no shadow descent', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(composedActiveElement(document)).toBe(btn);
    btn.remove();
  });

  it('descends into an open shadow root to find the truly-focused element', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    inner.tabIndex = 0;
    shadow.appendChild(inner);
    inner.focus();
    expect(composedActiveElement(document)).toBe(inner);
    host.remove();
  });
});

describe('composedContains', () => {
  it('true when node is a direct light-DOM descendant of anchor', () => {
    const anchor = document.createElement('div');
    const child = document.createElement('button');
    anchor.appendChild(child);
    document.body.appendChild(anchor);
    expect(composedContains(anchor, child)).toBe(true);
    anchor.remove();
  });

  it('false when node is outside anchor entirely', () => {
    const anchor = document.createElement('div');
    const other = document.createElement('button');
    document.body.appendChild(anchor);
    document.body.appendChild(other);
    expect(composedContains(anchor, other)).toBe(false);
    anchor.remove();
    other.remove();
  });

  it('true when node is inside an open shadow root whose host IS the anchor (the case plain Node.contains fails)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    shadow.appendChild(inner);
    // Sanity: native Node.contains cannot see into the shadow root.
    expect(host.contains(inner)).toBe(false);
    expect(composedContains(host, inner)).toBe(true);
    host.remove();
  });
});

describe('documentHasRealFocus', () => {
  it('false when active element is document.body', () => {
    expect(documentHasRealFocus(document)).toBe(false);
  });

  it('false when active element is document.documentElement', () => {
    // jsdom/happy-dom: documentElement can become active via tabIndex + focus
    // in some engines; simulate directly by asserting the predicate handles it.
    const docEl = document.documentElement;
    docEl.tabIndex = -1;
    docEl.focus();
    // Some DOM implementations refuse to focus documentElement and fall back
    // to body; either way the predicate must be false for both.
    expect(documentHasRealFocus(document)).toBe(false);
  });

  it('true when a real element outside body/documentElement holds focus', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(documentHasRealFocus(document)).toBe(true);
    btn.remove();
  });
});

describe('focusIsWithinScope', () => {
  it('false on a cold document with nothing focused, regardless of scope', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    expect(focusIsWithinScope([anchor], document)).toBe(false);
    anchor.remove();
  });

  it('true when the focused element is inside one of the anchors', () => {
    const anchor = document.createElement('div');
    const child = document.createElement('button');
    anchor.appendChild(child);
    document.body.appendChild(anchor);
    child.focus();
    expect(focusIsWithinScope([anchor], document)).toBe(true);
    anchor.remove();
  });

  it('false when the focused element is outside every anchor (strict containment, not document-scoped)', () => {
    const anchor = document.createElement('div');
    const outside = document.createElement('button');
    document.body.appendChild(anchor);
    document.body.appendChild(outside);
    outside.focus();
    expect(focusIsWithinScope([anchor], document)).toBe(false);
    anchor.remove();
    outside.remove();
  });

  it('true when the focused element is inside a shadow root whose host is an anchor', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    shadow.appendChild(inner);
    inner.focus();
    expect(focusIsWithinScope([host], document)).toBe(true);
    host.remove();
  });

  it('falls back to documentHasRealFocus when scope is empty', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    expect(focusIsWithinScope([], document)).toBe(true);
    outside.remove();
  });

  it('falls back to documentHasRealFocus when scope is null', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    expect(focusIsWithinScope(null, document)).toBe(true);
    outside.remove();
  });

  it('falls back to documentHasRealFocus when every scope entry is null or disconnected', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const disconnected = document.createElement('div');
    expect(focusIsWithinScope([null, disconnected], document)).toBe(true);
    outside.remove();
  });

  it('a single Element scope value (not an array) is normalized correctly', () => {
    const anchor = document.createElement('div');
    const child = document.createElement('button');
    anchor.appendChild(child);
    document.body.appendChild(anchor);
    child.focus();
    expect(focusIsWithinScope(anchor, document)).toBe(true);
    anchor.remove();
  });

  // Drill-continuity patch — found via this plan's own Docker VR run against
  // @rozie-ui/date-picker's months->years drill: a component-internal
  // transition can remove the element that currently holds focus (a plain
  // sibling trigger, not itself a keynav item) as part of the SAME
  // synchronous render that mounts a NEW attachment — by the time that new
  // attachment's guard check runs, `document.activeElement` has already
  // reverted to `body`, even though focus was genuinely inside the
  // component a moment ago.
  //
  // happy-dom does NOT implement the WHATWG "unfocusing steps" — `.remove()`
  // on a focused element reverts `document.activeElement` to `body` (that
  // part matches real browsers, verified separately) but never fires a
  // `focusout` event the way real Chromium does (verified directly against
  // real Chromium via Playwright at implementation time: `relatedTarget` is
  // `null` and the target's `parentNode` is STILL its ancestor at the
  // instant the event fires). `dispatchRemovalFocusOut` below manually
  // dispatches the same event shape WHILE the element is still attached —
  // exactly mirroring real-browser timing — so these tests exercise the
  // listener's real logic rather than a happy-dom-specific gap.
  function dispatchRemovalFocusOut(el: HTMLElement): void {
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
  }

  it('a same-tick DOM removal of the focused element (relatedTarget null) is treated as still-within-scope for the NEXT check', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const trigger = document.createElement('button');
    anchor.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Simulate the transition: the trigger is about to be removed (as
    // `enterYearsView` tearing down the whole months panel would) — dispatch
    // the focusout REAL Chromium fires at this exact instant (target still
    // attached), then complete the removal itself.
    dispatchRemovalFocusOut(trigger);
    trigger.remove();
    expect(document.activeElement).toBe(document.body);

    expect(focusIsWithinScope([anchor], document)).toBe(true);
    anchor.remove();
  });

  it('the same-tick-removal fallback stays valid for MULTIPLE checks within the same render batch (a multi-group consumer — e.g. date-picker\'s day/months/years attachments — each checks once)', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const trigger = document.createElement('button');
    anchor.appendChild(trigger);
    trigger.focus();
    dispatchRemovalFocusOut(trigger);
    trigger.remove();

    // NOT consumed on the first read — every attachment checking within the
    // SAME render batch must see the SAME value (found via date-picker's
    // real 3-group shape: a stale/redundant re-fire on an UNRELATED
    // attachment must not starve the one the transition is actually FOR).
    expect(focusIsWithinScope([anchor], document)).toBe(true);
    expect(focusIsWithinScope([anchor], document)).toBe(true);
    expect(focusIsWithinScope([anchor], document)).toBe(true);

    anchor.remove();
  });

  it('the same-tick-removal fallback EXPIRES on the next animation frame — a later unrelated guarded pass does not keep reusing it', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    try {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);
      const trigger = document.createElement('button');
      anchor.appendChild(trigger);
      trigger.focus();
      dispatchRemovalFocusOut(trigger);
      trigger.remove();

      expect(focusIsWithinScope([anchor], document)).toBe(true);
      expect(rafCallbacks).toHaveLength(1);

      // The browser paints — the deferred expiry fires.
      rafCallbacks[0]!(0);

      expect(focusIsWithinScope([anchor], document)).toBe(false);
      anchor.remove();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the same-tick-removal fallback does NOT apply when the removed element was OUTSIDE scope (strict containment preserved)', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const outsideTrigger = document.createElement('button');
    document.body.appendChild(outsideTrigger);
    outsideTrigger.focus();
    dispatchRemovalFocusOut(outsideTrigger);
    outsideTrigger.remove();

    expect(focusIsWithinScope([anchor], document)).toBe(false);
    anchor.remove();
  });

  it('an ORDINARY blur (relatedTarget set — focus moved to a real element) never feeds the fallback', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const trigger = document.createElement('button');
    anchor.appendChild(trigger);
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);

    trigger.focus();
    // An ordinary blur — trigger stays connected, relatedTarget is real
    // (elsewhere), so this must NEVER populate the fallback tracker.
    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: elsewhere }));
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);

    // Now elsewhere blurs-to-nothing (a real removal-style focusout) and IS
    // tracked — but elsewhere was never inside anchor, so this stays false;
    // the real assertion is that `trigger`'s EARLIER ordinary blur never
    // poisoned the tracker in the first place (if it had, this check would
    // incorrectly see trigger's chain instead of elsewhere's).
    dispatchRemovalFocusOut(elsewhere);
    elsewhere.remove();
    expect(document.activeElement).toBe(document.body);
    expect(focusIsWithinScope([anchor], document)).toBe(false);

    anchor.remove();
  });
});
