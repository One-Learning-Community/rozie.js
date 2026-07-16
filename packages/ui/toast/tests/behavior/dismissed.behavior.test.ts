// @vitest-environment happy-dom
/**
 * dismissed.behavior.test.ts — mount-and-drive behavioral proof for the
 * state-driven exit lifecycle + the family's FIRST event `@dismissed { toast,
 * reason }` (TOAST-EVENT).
 *
 * Mirrors combobox's tests/seed-query.behavior.test.ts precedent: mount the
 * REAL committed emitted packages/vue/src/Toaster.vue, obtain the `$expose`d
 * handle via a template ref, drive it, and assert on the emitted events + the
 * rendered `[role="status"]` DOM.
 *
 * RED-FIRST: run against the CURRENT (un-regenerated) leaf — it has NO emit
 * at all (`Toaster` emits nothing pre-TOAST-EVENT) — every assertion on the
 * `dismissed` events array below FAILS (always empty). GREEN only after the
 * source adds the `dismissBegin(id, reason)` funnel + `$emit('dismissed', …)`
 * + `node scripts/codegen.mjs` regenerates the Vue leaf.
 *
 * The 'swipe' reason is proven separately in the Task 6 Playwright VR battery
 * (a real pointer gesture) — not here.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Toaster from '../../packages/vue/src/Toaster.vue';

interface ToasterHandle {
  show: (input?: Record<string, unknown>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

interface DismissedPayload {
  toast: { id: string; message: string; type: string; duration: number };
  reason: 'timeout' | 'swipe' | 'close' | 'api';
}

const hosts: HTMLElement[] = [];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
  vi.useRealTimers();
});

function mountToaster(props: Record<string, unknown> = {}) {
  const handleRef = ref<ToasterHandle | null>(null);
  const dismissed: DismissedPayload[] = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const app = createApp({
    render: () =>
      h(Toaster, {
        ref: handleRef,
        position: 'bottom-right',
        onDismissed: (payload: DismissedPayload) => dismissed.push(payload),
        ...props,
      }),
  });
  app.mount(host);
  return { app, host, handle: () => handleRef.value as ToasterHandle, dismissed };
}

function statusCount(host: HTMLElement): number {
  return host.querySelectorAll('[role="status"]').length;
}

// Fast-forward past both the CSS exit animation AND the ~350ms JS failsafe
// (happy-dom never fires a real `animationend`, so the failsafe drives
// removal here) so a dismissed toast is fully gone from the DOM. `extraMs`
// lets a caller add the toast's own auto-dismiss duration on top of the
// ~350ms failsafe window (e.g. a duration:200 toast needs ~200ms to even
// START exiting before the failsafe can remove it).
async function settleExit(extraMs = 0) {
  await vi.advanceTimersByTimeAsync(400 + extraMs);
  await nextTick();
}

describe('Toaster @dismissed — exit lifecycle (behavioral)', () => {
  it("dismiss(id) verb fires @dismissed with reason 'api' exactly once", async () => {
    const { app, host, handle, dismissed } = mountToaster();
    const id = handle().show({ message: 'Saved', type: 'success', duration: 0 });
    await nextTick();

    handle().dismiss(id);
    await settleExit();

    expect(dismissed.length).toBe(1);
    expect(dismissed[0].reason).toBe('api');
    expect(dismissed[0].toast.id).toBe(id);
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it("the close button fires @dismissed with reason 'close' exactly once", async () => {
    const { app, host, handle, dismissed } = mountToaster();

    handle().show({ message: 'Saved', type: 'success', duration: 0 });
    await nextTick();

    host.querySelector('.rozie-toast-close')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settleExit();

    expect(dismissed.length).toBe(1);
    expect(dismissed[0].reason).toBe('close');
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it("timer expiry fires @dismissed with reason 'timeout' exactly once", async () => {
    const { app, host, handle, dismissed } = mountToaster();
    handle().show({ message: 'Saved', type: 'success', duration: 200 });
    await nextTick();

    await settleExit(200);

    expect(dismissed.length).toBe(1);
    expect(dismissed[0].reason).toBe('timeout');
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('clear() removes everything immediately and fires NOTHING', async () => {
    const { app, host, handle, dismissed } = mountToaster();
    handle().show({ message: 'a', duration: 0 });
    handle().show({ message: 'b', duration: 0 });
    await nextTick();
    expect(statusCount(host)).toBe(2);

    handle().clear();
    await nextTick();

    expect(statusCount(host)).toBe(0);
    expect(dismissed.length).toBe(0);

    app.unmount();
  });

  it('double-dismiss is idempotent: a timeout firing during an in-flight exit does not emit twice', async () => {
    const { app, host, handle, dismissed } = mountToaster();
    const id = handle().show({ message: 'Saved', type: 'success', duration: 100 });
    await nextTick();

    // Explicitly dismiss BEFORE the timer would have fired — the timeout's
    // scheduled callback (if not cleared) or a stray second dismiss() call
    // must be a no-op once the entry is already `exiting`.
    handle().dismiss(id);
    handle().dismiss(id); // a second, redundant dismiss on the same id
    await settleExit();

    expect(dismissed.length).toBe(1);
    expect(dismissed[0].reason).toBe('api');

    app.unmount();
  });

  it('the payload is ONE object { toast, reason } carrying the full queue entry', async () => {
    const { app, handle, dismissed } = mountToaster();
    const id = handle().show({ message: 'Hello', type: 'warning', duration: 0 });
    await nextTick();

    handle().dismiss(id);
    await settleExit();

    expect(dismissed.length).toBe(1);
    const payload = dismissed[0];
    expect(payload).toHaveProperty('toast');
    expect(payload).toHaveProperty('reason');
    expect(payload.toast).toMatchObject({ id, message: 'Hello', type: 'warning' });

    app.unmount();
  });
});

describe('Toaster exit failsafe — cleaned up on unmount (T2, behavioral)', () => {
  // RED-FIRST: dismissBegin scheduled the ~350ms removal failsafe via an
  // UNTRACKED window.setTimeout, so $onUnmount's teardown could not clear it —
  // a dismiss immediately followed by an unmount left the failsafe pending and
  // it fired post-unmount, writing $data on a torn-down instance. The fix
  // records failsafe handles in a module `exitFailsafes` map, cleared by
  // teardownTimers ($onUnmount / clear()) and cancelled first-wins by
  // removeToast. `vi.getTimerCount()` proves the pending timer is gone.
  it('a dismiss-then-unmount within the failsafe window leaves NO pending timer', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'x', type: 'info', duration: 0 }); // sticky → no auto-timer
    await nextTick();
    expect(statusCount(host)).toBe(1);

    // Dismiss → schedules the ~350ms removal failsafe (the only pending timer).
    handle().dismiss(id);
    await nextTick();
    expect(vi.getTimerCount()).toBe(1);

    // Unmount BEFORE the failsafe fires — teardown must clear it.
    app.unmount();
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);

    // And advancing time triggers nothing (no post-unmount $data write / throw).
    let threw = false;
    try {
      await vi.advanceTimersByTimeAsync(1000);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('the @animationend removal path cancels the pending failsafe first-wins', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'x', type: 'info', duration: 0 });
    await nextTick();

    handle().dismiss(id);
    await nextTick();
    expect(vi.getTimerCount()).toBe(1); // failsafe pending

    // Fire the element's animationend (the real removal path) — it removes the
    // toast AND must cancel the now-redundant failsafe.
    host.querySelector('.rozie-toast')!.dispatchEvent(new AnimationEvent('animationend'));
    await nextTick();

    expect(statusCount(host)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    app.unmount();
  });
});
