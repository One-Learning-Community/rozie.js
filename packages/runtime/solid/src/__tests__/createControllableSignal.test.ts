/**
 * createControllableSignal unit tests (D-135).
 * Tests 1-4 from Plan 06.3-01 Task 1 behavior spec.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { createControllableSignal } from '../createControllableSignal.js';

describe('createControllableSignal', () => {
  it('Test 1: controlled mode — getter reads parent value; setter invokes onValueChange; get() unchanged', () => {
    createRoot((dispose) => {
      const onValueChange = vi.fn();
      const props: Record<string, unknown> = { value: 5, onValueChange };
      const [get, set] = createControllableSignal(props, 'value', 0);
      expect(get()).toBe(5);
      set(7 as unknown as Parameters<typeof set>[0]);
      expect(onValueChange).toHaveBeenCalledWith(7);
      expect(get()).toBe(5); // parent still owns
      dispose();
    });
  });

  it('Test 2: uncontrolled mode — getter returns defaultValue; setter updates get() and fires callback', () => {
    createRoot((dispose) => {
      const onValueChange = vi.fn();
      const props: Record<string, unknown> = { defaultValue: 3, onValueChange };
      const [get, set] = createControllableSignal(props, 'value', 0);
      expect(get()).toBe(3);
      set(8 as unknown as Parameters<typeof set>[0]);
      expect(onValueChange).toHaveBeenCalledWith(8);
      expect(get()).toBe(8);
      dispose();
    });
  });

  it('Test 3: functional updater in uncontrolled mode', () => {
    createRoot((dispose) => {
      const props: Record<string, unknown> = { defaultValue: 4 };
      const [get, set] = createControllableSignal(props, 'value', 0);
      set(((prev: number) => prev + 1) as unknown as Parameters<typeof set>[0]);
      expect(get()).toBe(5);
      dispose();
    });
  });

  // Quick task 260521-qsh — close the `props ?? {}` undefined-arm branch.
  it('Test 4a: tolerates an undefined props object (D-VR-03 bare-mount path)', () => {
    createRoot((dispose) => {
      const [get, set] = createControllableSignal<number>(undefined, 'value', 9);
      // No props at all — getter falls back to defaultFallback.
      expect(get()).toBe(9);
      // Uncontrolled (no `value` key) — setter updates the internal signal.
      set(11 as unknown as Parameters<typeof set>[0]);
      expect(get()).toBe(11);
      dispose();
    });
  });

  // Quick task 260521-qsh — close the controlled→uncontrolled message arms.
  it('Test 4b: controlled→uncontrolled flip warns once with the controlled→uncontrolled message', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRoot((dispose) => {
      // Start controlled (a `value` key is present).
      const props: Record<string, unknown> = { value: 5 };
      const [get, set] = createControllableSignal(props, 'value', 0);
      expect(get()).toBe(5);

      // Parent stops controlling — remove the `value` key.
      delete props['value'];
      set(8 as unknown as Parameters<typeof set>[0]);

      expect(warnSpy).toHaveBeenCalledOnce();
      const warnMsg = warnSpy.mock.calls[0]![0] as string;
      expect(warnMsg).toContain('[ROZ812]');
      // Exercises the `wasInitiallyControlled ? 'controlled' : ...` true-arm
      // and the `nowControlled ? ... : 'uncontrolled'` false-arm.
      expect(warnMsg).toContain('from controlled to uncontrolled');
      dispose();
    });
    warnSpy.mockRestore();
  });

  it('Test 4: parent-flip ROZ812 warning emitted exactly once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRoot((dispose) => {
      // Start uncontrolled (no value key in props)
      const props: Record<string, unknown> = { defaultValue: 0 };
      const [get, set] = createControllableSignal(props, 'value', 0);
      expect(get()).toBe(0);

      // Simulate parent-flip: add value to props (now controlled)
      props['value'] = 7;
      // Trigger setter to detect the flip
      set(9 as unknown as Parameters<typeof set>[0]);

      expect(warnSpy).toHaveBeenCalledOnce();
      // `toHaveBeenCalledOnce()` above guarantees calls[0] exists; the
      // non-null assertion satisfies `noUncheckedIndexedAccess`-style strict
      // tsconfig (surfaced when this file's typecheck cache invalidated).
      const warnMsg = warnSpy.mock.calls[0]![0] as string;
      expect(warnMsg).toContain('[ROZ812]');
      expect(warnMsg.toLowerCase()).toMatch(/controlled/);
      expect(warnMsg.toLowerCase()).toMatch(/mid-lifecycle/);

      // Second setter should NOT warn again (warned flag)
      set(10 as unknown as Parameters<typeof set>[0]);
      expect(warnSpy).toHaveBeenCalledOnce(); // still once

      dispose();
    });
    warnSpy.mockRestore();
  });
});
