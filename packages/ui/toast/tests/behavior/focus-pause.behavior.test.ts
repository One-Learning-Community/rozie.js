// @vitest-environment happy-dom
/**
 * focus-pause.behavior.test.ts — keyboard-focus pauses the auto-dismiss timer
 * the same way hover does (WCAG 2.2.1: Timing Adjustable). A keyboard user who
 * tabs to a toast's action button must not lose the toast to the timeout
 * mid-interaction — the pre-fix source only wired `@mouseenter`/`@mouseleave`
 * on the region, so a keyboard-only user had NO way to pause the timer at all.
 *
 * Also proves the two pause SOURCES (hover, focus) compose correctly: leaving
 * one must not resume the timers while the other is still active — else a
 * mouse-then-keyboard (or keyboard-then-mouse) handoff loses the toast to the
 * timeout right as the user is interacting with it.
 *
 * RED-FIRST: run against the CURRENT (un-regenerated) leaf — there is no
 * `@focusin`/`@focusout` binding on the region at all, so dispatching those
 * events is a no-op and the toast dismisses on its original schedule
 * regardless of focus. GREEN only after `node scripts/codegen.mjs`
 * regenerates the Vue leaf from the fixed Toaster.rozie source (onFocusIn /
 * onFocusOut wired to pauseTimers/resumeTimers, composing with hovering).
 *
 * Mirrors timers.behavior.test.ts's mount-and-drive pattern; focusin/focusout
 * are dispatched directly (bubbling DOM events) on a toast's action button,
 * matching how that file dispatches mouseenter/mouseleave directly on the
 * region rather than relying on a real browser hover.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Toaster from '../../packages/vue/src/Toaster.vue';

interface ToasterHandle {
  show: (input?: Record<string, unknown>) => string;
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
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const app = createApp({
    render: () => h(Toaster, { ref: handleRef, position: 'bottom-right', ...props }),
  });
  app.mount(host);
  return { app, host, handle: () => handleRef.value as ToasterHandle };
}

function statusCount(host: HTMLElement): number {
  return host.querySelectorAll('[role="status"]').length;
}

function region(host: HTMLElement): HTMLElement {
  return host.querySelector('.rozie-toaster')!;
}

function actionButton(host: HTMLElement): HTMLButtonElement {
  return host.querySelector<HTMLButtonElement>('.rozie-toast-action')!;
}

// focusin/focusout bubble (unlike focus/blur), so dispatching them on the
// action button propagates up to the region's listener exactly as a real
// Tab-driven focus change would.
function dispatchFocusIn(el: HTMLElement) {
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}
function dispatchFocusOut(el: HTMLElement, relatedTarget: EventTarget | null = null) {
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
}

describe('Toaster keyboard-focus pause (behavioral, WCAG 2.2.1)', () => {
  it('focusing the action button pauses the timer; focus leaving (to outside the region) resumes it', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({
      message: 'x',
      duration: 1000,
      action: { label: 'Act', onClick: () => {} },
    });
    await nextTick();
    expect(statusCount(host)).toBe(1);

    // Focus lands on the action button at ~600ms in.
    await vi.advanceTimersByTimeAsync(600);
    dispatchFocusIn(actionButton(host));
    await nextTick();

    // Well past the ORIGINAL 1000ms total — must still be present (paused).
    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCount(host)).toBe(1);

    // Focus leaves the region entirely (relatedTarget outside it) — resumes
    // with the ~400ms remainder.
    dispatchFocusOut(actionButton(host), document.body);
    await nextTick();

    await vi.advanceTimersByTimeAsync(390);
    expect(statusCount(host)).toBe(1);

    await vi.advanceTimersByTimeAsync(20);
    await nextTick();
    await vi.advanceTimersByTimeAsync(360); // exit failsafe
    await nextTick();
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('mouse-leave does NOT resume while keyboard focus is still inside the region', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({
      message: 'x',
      duration: 1000,
      action: { label: 'Act', onClick: () => {} },
    });
    await nextTick();

    region(host).dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    dispatchFocusIn(actionButton(host));
    await nextTick();

    // Mouse leaves the region — focus is STILL inside, so this must be a no-op.
    region(host).dispatchEvent(new MouseEvent('mouseleave'));
    await nextTick();

    await vi.advanceTimersByTimeAsync(2000); // well past the original duration
    expect(statusCount(host)).toBe(1);

    // NOW focus also leaves — both pause sources cleared, resumes + dismisses.
    dispatchFocusOut(actionButton(host), document.body);
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    await vi.advanceTimersByTimeAsync(360);
    await nextTick();
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('focus-out does NOT resume while the pointer is still hovering the region', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({
      message: 'x',
      duration: 1000,
      action: { label: 'Act', onClick: () => {} },
    });
    await nextTick();

    dispatchFocusIn(actionButton(host));
    await nextTick();
    region(host).dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();

    // Focus leaves the region — hover is STILL active, so this must be a no-op.
    dispatchFocusOut(actionButton(host), document.body);
    await nextTick();

    await vi.advanceTimersByTimeAsync(2000);
    expect(statusCount(host)).toBe(1);

    // NOW the pointer also leaves — both pause sources cleared.
    region(host).dispatchEvent(new MouseEvent('mouseleave'));
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    await vi.advanceTimersByTimeAsync(360);
    await nextTick();
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('a focusout whose relatedTarget is still inside the region (child-to-child handoff) does not resume', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'a', duration: 1000, action: { label: 'Act', onClick: () => {} } });
    await nextTick();

    dispatchFocusIn(actionButton(host));
    await nextTick();

    // Focus hands off from the action button to the close button — BOTH are
    // inside the same region, so this must NOT resume the timer.
    const closeBtn = host.querySelector<HTMLButtonElement>('.rozie-toast-close')!;
    dispatchFocusOut(actionButton(host), closeBtn);
    await nextTick();
    dispatchFocusIn(closeBtn);
    await nextTick();

    await vi.advanceTimersByTimeAsync(2000);
    expect(statusCount(host)).toBe(1);

    dispatchFocusOut(closeBtn, document.body);
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    await vi.advanceTimersByTimeAsync(360);
    await nextTick();
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('sticky toasts (duration <= 0) never enter the timers map — focus is a no-op for them', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'Sticky', duration: 0, action: { label: 'Act', onClick: () => {} } });
    await nextTick();
    expect(statusCount(host)).toBe(1);

    dispatchFocusIn(actionButton(host));
    await nextTick();
    dispatchFocusOut(actionButton(host), document.body);
    await nextTick();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(statusCount(host)).toBe(1);

    app.unmount();
  });
});
