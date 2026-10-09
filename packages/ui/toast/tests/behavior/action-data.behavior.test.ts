// @vitest-environment happy-dom
/**
 * action-data.behavior.test.ts — a toast can carry an action and pass-through data.
 *
 * Reported from dogfooding (oinbox): `show()` dropped every field but id/message/type/duration,
 * so an "Undo" toast had to be rendered through `#toast` with a side map from toast id to
 * action. Now:
 *   - `show({ action: { label, onClick } })` renders an action button in the DEFAULT toast;
 *     clicking it calls `onClick({ id, data })` and dismisses with reason 'action';
 *   - `data` rides on the toast untouched — in the `#toast` slot scope, the `dismissed`
 *     payload, and the action callback;
 *   - `patch(id, { action, data })` updates both (a promise toast gains its Undo on success);
 *   - an action without an `onClick` function is ignored (no dead button).
 *
 * Mounts the REAL committed emitted Vue leaf (dismissed.behavior.test.ts pattern).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Toaster from '../../packages/vue/src/Toaster.vue';

interface ToasterHandle {
  show: (input?: Record<string, unknown>) => string;
  patch: (id: string, changes: Record<string, unknown>) => boolean;
}
interface DismissedPayload {
  toast: { id: string; data?: unknown };
  reason: string;
}

const hosts: HTMLElement[] = [];
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { for (const host of hosts.splice(0)) host.remove(); vi.useRealTimers(); });

function mountToaster(slots?: Record<string, unknown>) {
  const handleRef = ref<ToasterHandle | null>(null);
  const dismissed: DismissedPayload[] = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const app = createApp({
    render: () =>
      h(Toaster, { ref: handleRef, position: 'bottom-right', onDismissed: (p: DismissedPayload) => dismissed.push(p) }, slots as never),
  });
  app.mount(host);
  return { app, host, handle: () => handleRef.value as ToasterHandle, dismissed };
}
const settleExit = async () => { await vi.advanceTimersByTimeAsync(400); await nextTick(); };
const actionButton = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('.rozie-toast-action');

describe('Toaster action + data (behavioral)', () => {
  it('renders the action; clicking it calls onClick({ id, data }) and dismisses with reason "action"', async () => {
    const { app, host, handle, dismissed } = mountToaster();
    const calls: Array<{ id: string; data: unknown }> = [];
    const id = handle().show({
      message: 'Conversation archived',
      duration: 0,
      data: { threadId: 't42' },
      action: { label: 'Undo', onClick: (ctx: { id: string; data: unknown }) => calls.push(ctx) },
    });
    await nextTick();

    const btn = actionButton(host);
    expect(btn, 'no action button rendered').not.toBeNull();
    expect(btn!.textContent?.trim()).toBe('Undo');
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settleExit();

    expect(calls).toEqual([{ id, data: { threadId: 't42' } }]);
    expect(dismissed.map((d) => d.reason)).toEqual(['action']);
    expect(dismissed[0].toast.data).toEqual({ threadId: 't42' });
    expect(host.querySelectorAll('.rozie-toast').length).toBe(0);
    app.unmount();
  });

  it('passes data through to the #toast slot scope', async () => {
    const seen: unknown[] = [];
    const { app, handle } = mountToaster({
      toast: ({ toast }: { toast: { data?: unknown } }) => { seen.push(toast.data); return h('span', 'custom'); },
    });
    handle().show({ message: 'x', duration: 0, data: { n: 7 } });
    await nextTick();
    expect(seen.at(-1)).toEqual({ n: 7 });
    app.unmount();
  });

  it('patch() adds an action and data to an existing toast', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'Sending…', type: 'loading', duration: 0 });
    await nextTick();
    expect(actionButton(host)).toBeNull();

    let undone = false;
    expect(handle().patch(id, { type: 'success', message: 'Sent', data: { m: 1 }, action: { label: 'Undo', onClick: () => { undone = true; } } })).toBe(true);
    await nextTick();
    actionButton(host)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settleExit();
    expect(undone).toBe(true);
    app.unmount();
  });

  it('ignores an action without an onClick function', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'x', duration: 0, action: { label: 'Nope' } });
    await nextTick();
    expect(actionButton(host)).toBeNull();
    app.unmount();
  });

  // quick 260926-i1f Item 1: runAction() called onClick with no try/finally, so a
  // throwing callback skipped dismissBegin(id, 'action') entirely — the toast was
  // stuck forever. RED-FIRST: on the un-fixed source this assertion fails (the
  // toast is still present, no 'action' dismissal fired) and the thrown error is
  // never observed (silently lost inside Vue's synthetic event dispatch). GREEN
  // once runAction wraps the callback in try/finally (always dismiss) and does
  // NOT swallow the error — it is allowed to propagate (Vue surfaces it via its
  // own global unhandled-error reporting, the same as any other native DOM click
  // handler that throws).
  it('an onClick that throws still dismisses with reason \'action\' (does not swallow the error)', async () => {
    const { app, host, handle, dismissed } = mountToaster();
    const id = handle().show({
      message: 'Conversation archived',
      duration: 0,
      action: { label: 'Undo', onClick: () => { throw new Error('boom'); } },
    });
    await nextTick();

    const btn = actionButton(host);
    expect(btn).not.toBeNull();

    let observedThrow = false;
    const onWindowError = () => { observedThrow = true; };
    window.addEventListener('error', onWindowError);
    try {
      btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } catch {
      observedThrow = true;
    }
    await settleExit();
    window.removeEventListener('error', onWindowError);

    expect(observedThrow, 'onClick throw must not be silently swallowed').toBe(true);
    expect(dismissed.map((d) => d.reason)).toEqual(['action']);
    expect(dismissed[0].toast.id).toBe(id);
    expect(host.querySelectorAll('.rozie-toast').length).toBe(0);
    app.unmount();
  });
});
