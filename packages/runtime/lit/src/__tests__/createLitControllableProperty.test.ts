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
