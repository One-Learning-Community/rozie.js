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
    expect(e.bubbles).toBe(true);
    expect(e.composed).toBe(true);
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

  it('property-setter write still dispatches the change event via a subsequent producer write()', () => {
    // notifyPropertyWrite itself does not dispatch (it is the parent asserting
    // its own value — dispatching back would loop). The producer's write()
    // remains the dispatch path, and it carries the resolved value out.
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
    cp.notifyPropertyWrite(3);
    expect(dispatched).toHaveLength(0);
    cp.write(4);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.detail).toBe(4);
  });
});
