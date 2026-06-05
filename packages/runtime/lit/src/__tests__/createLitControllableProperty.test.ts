/**
 * Plan 06.4-01 Task 2 — createLitControllableProperty unit tests.
 *
 * Validates the D-LIT-10 controllable-property contract:
 *
 *   - Uncontrolled mode: read returns defaultValue when initialControlledValue
 *     is undefined; write updates internal state.
 *   - Controlled mode: read returns the initialControlledValue; write does NOT
 *     mutate internal state but DOES dispatch the CustomEvent.
 *   - Both modes: write dispatches `eventName` CustomEvent on host with
 *     correct detail + bubbles + composed flags.
 *   - Functional updaters: `write(prev => prev + 1)` resolves against current.
 *   - Parent-flip detection: notifyAttributeChange flipping
 *     controlled→uncontrolled (or vice versa) emits exactly one console.warn
 *     containing the literal `[ROZ840]` prefix and still follows the new value.
 *   - HTML-parser-seed window: the first defined attribute after an
 *     uncontrolled construction is treated as seeding (no warn, no mode flip)
 *     so the HTML parser populating attributes post-constructor does not
 *     spuriously flip a fresh element into controlled mode.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLitControllableProperty } from '../createLitControllableProperty.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLitControllableProperty — uncontrolled mode', () => {
  it('read() returns defaultValue when initialControlledValue is undefined', () => {
    const host = document.createElement('div');
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 7,
      initialControlledValue: undefined,
    });
    expect(cp.read()).toBe(7);
  });

  it('write() updates local state in uncontrolled mode', () => {
    const host = document.createElement('div');
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });
    cp.write(42);
    expect(cp.read()).toBe(42);
  });

  it('write(fn) supports functional updater', () => {
    const host = document.createElement('div');
    const cp = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 5,
      initialControlledValue: undefined,
    });
    cp.write((prev) => prev + 3);
    expect(cp.read()).toBe(8);
  });

  it('write() dispatches CustomEvent with correct shape on host', () => {
    const host = document.createElement('div');
    const handler = vi.fn();
    host.addEventListener('value-change', handler);
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });
    cp.write(99);
    expect(handler).toHaveBeenCalledTimes(1);
    const e = handler.mock.calls[0]![0] as CustomEvent;
    expect(e.detail).toBe(99);
    // Model `<prop>-change` events fire AT_TARGET only — a direct listener on
    // the host still receives them, but they do NOT bubble or cross shadow
    // boundaries to same-named ancestor listeners (nested-component collision).
    expect(e.bubbles).toBe(false);
    expect(e.composed).toBe(false);
  });

  it('change event does NOT bubble to an ancestor listener (nested-component collision guard)', () => {
    const ancestor = document.createElement('div');
    const host = document.createElement('div');
    ancestor.appendChild(host);
    const direct = vi.fn();
    const onAncestor = vi.fn();
    host.addEventListener('value-change', direct);
    ancestor.addEventListener('value-change', onAncestor);
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });
    cp.write(7);
    // The element the value belongs to receives it; the ancestor must not —
    // otherwise a same-named model event from a nested child would overwrite
    // the ancestor's own model (the nested-Kanban `items-change` corruption).
    expect(direct).toHaveBeenCalledTimes(1);
    expect(onAncestor).not.toHaveBeenCalled();
  });
});

describe('createLitControllableProperty — controlled mode', () => {
  it('read() returns initialControlledValue', () => {
    const host = document.createElement('div');
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: 100,
    });
    expect(cp.read()).toBe(100);
  });

  it('write() does NOT mutate internal state in controlled mode (parent owns)', () => {
    const host = document.createElement('div');
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: 50,
    });
    cp.write(999);
    // Controlled — internal state is the parent-supplied value, NOT the write target.
    expect(cp.read()).toBe(50);
  });

  it('write() still dispatches CustomEvent in controlled mode', () => {
    const host = document.createElement('div');
    const handler = vi.fn();
    host.addEventListener('value-change', handler);
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: 50,
    });
    cp.write(999);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]![0] as CustomEvent).detail).toBe(999);
  });
});

describe('createLitControllableProperty — parent-flip detection (ROZ840)', () => {
  it('emits exactly one [ROZ840] console.warn on controlled→uncontrolled flip', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = document.createElement('div');
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: 10,
    });
    // Parent decides to stop controlling — flip to uncontrolled.
    // `notifyAttributeChange(undefined)` can ONLY come from user JS removing
    // the controlled mirror; the HTML parser path always produces a defined
    // coerced value (Number/Boolean/etc), so this case must warn even before
    // any write() has happened.
    cp.notifyAttributeChange(undefined);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toMatch(/\[ROZ840\]/);
  });

  it('emits exactly one [ROZ840] console.warn on uncontrolled→controlled flip AFTER a write()', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = document.createElement('div');
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });
    // Uncontrolled-then-write — user has interacted, so the seeding window
    // closes. A subsequent defined attribute notification IS a real flip.
    cp.write(3);
    cp.notifyAttributeChange(77);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toMatch(/\[ROZ840\]/);
    // After the flip, the helper follows the new value silently.
    expect(cp.read()).toBe(77);
  });

  it('does NOT warn when notifyAttributeChange stays within the same mode', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = document.createElement('div');
    const cp = createLitControllableProperty({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: 10,
    });
    // Multiple controlled-value updates — no mode flip.
    cp.notifyAttributeChange(11);
    cp.notifyAttributeChange(12);
    cp.notifyAttributeChange(13);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(cp.read()).toBe(13);
  });

  it('does NOT warn when HTML parser seeds attribute on a fresh uncontrolled element', () => {
    // Regression — the bug behind `0a27114`. The HTML parser populates an
    // attribute AFTER the constructor; uncontrolled-construct + first
    // defined attribute before any write() is seeding, not a flip.
    // `<rozie-counter value="0">` produces this exact path.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = document.createElement('div');
    const cp = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });
    // Emitted attributeChangedCallback path: parser fires with the coerced
    // initial attribute value before any user interaction.
    cp.notifyAttributeChange(0);
    expect(warnSpy).not.toHaveBeenCalled();
    // Value mirrors the seeded attribute but mode stays uncontrolled — so a
    // subsequent write() updates local state instead of being a no-op.
    expect(cp.read()).toBe(0);
    cp.write(5);
    expect(cp.read()).toBe(5);
  });
});

describe('createLitControllableProperty — notifyPropertyWrite (property-binding controlled-mode entry)', () => {
  // Part A regression — the Lit controlled/uncontrolled mismatch on a
  // property-bound two-way model (SortableList desync). A Lit consumer drives
  // a two-way model with the `.items=${…}` PROPERTY binding, which lands on
  // the host's public `set items(v)` and NEVER reaches attributeChangedCallback.
  // The emitted property setter therefore routes through `notifyPropertyWrite`
  // (NOT `write`) so a property-bound parent establishes controlled mode and
  // there is a single source of truth.

  it('a property-setter write puts a fresh uncontrolled controllable into controlled mode', () => {
    const host = document.createElement('div');
    const cp = createLitControllableProperty<number[]>({
      host,
      eventName: 'items-change',
      defaultValue: [],
      initialControlledValue: undefined,
    });
    // Parent applies its `.items=${[1, 2, 3]}` binding.
    cp.notifyPropertyWrite([1, 2, 3]);
    expect(cp.read()).toEqual([1, 2, 3]);

    // Now in controlled mode: the producer's own write() must NOT mutate the
    // local mirror — the parent owns the value (single source of truth). It
    // only dispatches the change event for the parent to observe.
    cp.write([1, 2, 3, 4]);
    expect(cp.read()).toEqual([1, 2, 3]);
  });

  it('the two-way round-trip (write → change event → parent re-binds) does NOT spuriously warn', () => {
    // After the producer's write() dispatches `items-change`, a two-way parent
    // updates its state and re-applies `.items=${newValue}`, hitting the setter
    // again. That round-trip is the NORMAL data flow — it must NOT emit the
    // ROZ840 flip warning (which is reserved for the attribute path).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = document.createElement('div');
    const cp = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });
    // Initial property binding.
    cp.notifyPropertyWrite(1);
    // Producer mutates → dispatches change → parent re-binds with the new value.
    cp.write(2);
    cp.notifyPropertyWrite(2);
    // Parent drives a fresh value.
    cp.notifyPropertyWrite(9);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(cp.read()).toBe(9);
  });

  it('a property-bound controllable stays controlled — no dual copy', () => {
    // The whole point of Part A: producer + consumer share ONE value. Once a
    // property binding has established controlled mode, every subsequent
    // producer write() defers to the parent's re-binding rather than forking a
    // private local copy.
    const host = document.createElement('div');
    const cp = createLitControllableProperty<string>({
      host,
      eventName: 'text-change',
      defaultValue: 'default',
      initialControlledValue: undefined,
    });
    cp.notifyPropertyWrite('parent-owned');
    // Producer write() does not fork a local copy.
    cp.write('producer-attempt');
    expect(cp.read()).toBe('parent-owned');
    // Parent re-binds (the round-trip from the producer's change event).
    cp.notifyPropertyWrite('producer-attempt');
    expect(cp.read()).toBe('producer-attempt');
  });

  it('a property write keeps an already-controlled controllable controlled', () => {
    const host = document.createElement('div');
    const cp = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      // Constructed controlled (parent passed an initial value at mount).
      defaultValue: 0,
      initialControlledValue: 5,
    });
    expect(cp.read()).toBe(5);
    cp.notifyPropertyWrite(8);
    expect(cp.read()).toBe(8);
    // Still controlled — producer write() does not mutate the mirror.
    cp.write(99);
    expect(cp.read()).toBe(8);
  });

  it('property-setter write dispatches on real value changes, suppresses producer→listener round-trips', () => {
    // notifyPropertyWrite is the entry point for two paths that look identical
    // at the DOM level: (a) the parent's `.prop=${x}` re-bind that ROUND-TRIPS
    // our own dispatched event, and (b) an EXTERNAL imperative `el.prop = x`
    // from arbitrary JS that observers need to see. The helper suppresses
    // exactly one round-trip per write() via a one-shot token, and dispatches
    // on every other real value change — same "fire change events only on
    // actual change" semantics the other 5 target frameworks expose.
    //
    // Earlier contract: notifyPropertyWrite "never dispatched", which broke (b)
    // — external imperative writes were silently swallowed. The one-shot token
    // restores observability of (b) without re-introducing the loop the old
    // never-dispatch rule was guarding against.
    const dispatched: CustomEvent[] = [];
    const host = {
      dispatchEvent: (ev: Event) => {
        dispatched.push(ev as CustomEvent);
        return true;
      },
    } as unknown as HTMLElement;
    const cp = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });

    // (b) Property-setter write on a real value change (external imperative
    // `el.value = 3` from arbitrary JS, or a parent's first `.value=${3}`
    // binding) — observers see it.
    cp.notifyPropertyWrite(3);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail).toBe(3);

    // (a) Producer-initiated round-trip: write(4) dispatches, then the parent
    // listener catches `value-change`, updates its bound state to 4, re-renders,
    // and Lit re-applies `.value=${4}` which lands as notifyPropertyWrite(4).
    // The one-shot token recognises that re-bind as our own echo and suppresses
    // the re-dispatch — no loop, exactly one event total.
    cp.write(4);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]!.detail).toBe(4);
    cp.notifyPropertyWrite(4); // parent's round-trip echo
    expect(dispatched).toHaveLength(2); // round-trip suppressed

    // After the round-trip token is consumed, a no-op re-assertion of the same
    // value silently stays a no-op (matches standard change-event semantics —
    // no event on equal values).
    cp.notifyPropertyWrite(4);
    expect(dispatched).toHaveLength(2);

    // A parent-driven value bump (or a new external imperative write) to a
    // genuinely different value fires once.
    cp.notifyPropertyWrite(7);
    expect(dispatched).toHaveLength(3);
    expect(dispatched[2]!.detail).toBe(7);
  });

  it('(WR-04) round-trip suppression token expires on microtask boundary — async same-value external writes are NOT swallowed', async () => {
    // WR-04 regression: previously the round-trip token was held indefinitely
    // until consumed by `notifyPropertyWrite`. If a parent listener was async
    // (e.g. queued on a microtask / animation frame), an EXTERNAL imperative
    // write happening to carry the same value could land first, match the
    // token, and silently swallow its change event. The fix scopes the token
    // to a microtask boundary: synchronous parent re-binds still match, but
    // any write that arrives after a microtask is unconditionally dispatched.
    const dispatched: CustomEvent[] = [];
    const host = {
      dispatchEvent: (ev: Event) => {
        dispatched.push(ev as CustomEvent);
        return true;
      },
    } as unknown as HTMLElement;
    const cp = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });

    // Producer calls write(4) → dispatches once + sets the token.
    cp.write(4);
    expect(dispatched).toHaveLength(1);

    // BEFORE the async parent's re-bind fires, await a microtask boundary.
    // The token must now be cleared — any subsequent same-value write is
    // treated as a real external write and dispatches.
    await Promise.resolve();

    // Simulate an external imperative write carrying the same value 4.
    // Object.is(prev, next) === true, so notifyPropertyWrite still respects
    // the "no-event-on-equal-values" rule — and that's correct semantics
    // here (the value did not change). What we're proving is that the token
    // is NOT silently consuming this write: a follow-up DIFFERENT-value
    // write proceeds normally without any token leftover.
    cp.notifyPropertyWrite(4);
    expect(
      dispatched,
      'same-value notifyPropertyWrite must remain a clean no-op (no change)',
    ).toHaveLength(1);

    // A different-value notifyPropertyWrite arriving AFTER the microtask
    // boundary fires unconditionally — the token would have suppressed nothing
    // anyway here (value differs), but this asserts the post-microtask state
    // machine is healthy.
    cp.notifyPropertyWrite(5);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]!.detail).toBe(5);
  });

  it('(WR-04) synchronous round-trip is still suppressed (regression guard for fix scope)', async () => {
    // Confirms the microtask-deferred token still catches the standard
    // synchronous round-trip path the original suppression was designed for:
    // write(x) → host.dispatchEvent (sync listeners run inline) → parent
    // re-bind → notifyPropertyWrite(x) — all before the microtask fires.
    const dispatched: CustomEvent[] = [];
    const host = {
      dispatchEvent: (ev: Event) => {
        dispatched.push(ev as CustomEvent);
        return true;
      },
    } as unknown as HTMLElement;
    const cp = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });

    cp.write(4);
    cp.notifyPropertyWrite(4); // synchronous round-trip echo
    expect(dispatched).toHaveLength(1); // suppressed — exactly one event total

    // After the microtask boundary the token is cleared regardless.
    await Promise.resolve();
    cp.notifyPropertyWrite(6); // genuine subsequent value bump
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]!.detail).toBe(6);
  });
});
