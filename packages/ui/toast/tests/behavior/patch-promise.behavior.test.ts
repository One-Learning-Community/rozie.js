// @vitest-environment happy-dom
/**
 * patch-promise.behavior.test.ts — mount-and-drive behavioral proof for the
 * `patch(id, changes)` update-in-place primitive and the `promise(p, {
 * loading, success, error })` sugar verb over the new `'loading'` toast type
 * (TOAST-PATCH, TOAST-PROMISE).
 *
 * Mirrors combobox's tests/seed-query.behavior.test.ts precedent: mount the
 * REAL committed emitted packages/vue/src/Toaster.vue, obtain the `$expose`d
 * handle via a template ref, drive it, and assert on the rendered
 * `[role="status"]` DOM + the timer/settle timing.
 *
 * RED-FIRST: run against the CURRENT (un-regenerated) leaf — `patch`/
 * `promise` are `not a function` (not yet exposed) and the `'loading'` type
 * has no spinner. Every assertion below FAILS or throws on that leaf. GREEN
 * only after the source adds `patch`/`promise` + the loading spinner +
 * `node scripts/codegen.mjs` regenerates the Vue leaf.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Toaster from '../../packages/vue/src/Toaster.vue';

interface ToasterHandle {
  show: (input?: Record<string, unknown>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  patch: (id: string, changes: Record<string, unknown>) => boolean;
  promise: (
    p: Promise<unknown>,
    opts: {
      loading: string;
      success: string | ((value: unknown) => string);
      error: string | ((reason: unknown) => string);
    },
  ) => string;
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
    render: () =>
      h(Toaster, {
        ref: handleRef,
        position: 'bottom-right',
        ...props,
      }),
  });
  app.mount(host);
  return { app, host, handle: () => handleRef.value as ToasterHandle };
}

function statusCount(host: HTMLElement): number {
  return host.querySelectorAll('[role="status"]').length;
}

function messageText(host: HTMLElement): string {
  return host.querySelector('.rozie-toast-message')?.textContent ?? '';
}

async function settleExit(extraMs = 0) {
  await vi.advanceTimersByTimeAsync(400 + extraMs);
  await nextTick();
}

/** A manually resolvable promise, so tests control settle timing precisely. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Toaster patch(id, changes) — update-in-place (behavioral)', () => {
  it('patch(id, { message }) changes the message on the SAME entry in place', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'Saving…', type: 'info', duration: 0 });
    await nextTick();
    expect(messageText(host)).toBe('Saving…');

    const ok = handle().patch(id, { message: 'Saved!' });
    await nextTick();

    expect(ok).toBe(true);
    expect(messageText(host)).toBe('Saved!');
    expect(statusCount(host)).toBe(1);

    app.unmount();
  });

  it('patch(id, { type }) changes the type', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'x', type: 'info', duration: 0 });
    await nextTick();
    expect(host.querySelector('.rozie-toast--info')).not.toBeNull();

    handle().patch(id, { type: 'success' });
    await nextTick();

    expect(host.querySelector('.rozie-toast--success')).not.toBeNull();
    expect(host.querySelector('.rozie-toast--info')).toBeNull();

    app.unmount();
  });

  it('patch(id, { duration: 0 }) clears the running timer and goes sticky', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'x', duration: 500 });
    await nextTick();

    handle().patch(id, { duration: 0 });
    await nextTick();

    // Well past the original 500ms + the exit failsafe — still present.
    await vi.advanceTimersByTimeAsync(5000);
    await nextTick();
    expect(statusCount(host)).toBe(1);

    app.unmount();
  });

  it('patch(sticky, { duration: 1000 }) starts a timer', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'x', duration: 0 });
    await nextTick();

    handle().patch(id, { duration: 200 });
    await nextTick();

    await settleExit(200);
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('patching keys OTHER than duration does NOT reset a running timer', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'x', duration: 500 });
    await nextTick();

    // Elapse most of the duration, then patch the message only.
    await vi.advanceTimersByTimeAsync(400);
    handle().patch(id, { message: 'still going' });
    await nextTick();
    expect(statusCount(host)).toBe(1);

    // The ORIGINAL schedule fires ~100ms later (500 total), NOT restarted to
    // a fresh 500ms from the patch.
    await vi.advanceTimersByTimeAsync(100);
    await nextTick();
    await vi.advanceTimersByTimeAsync(360); // exit failsafe
    await nextTick();
    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('patch(unknownId, …) returns false with no throw; patch(existingId, …) returns true', async () => {
    const { app, handle } = mountToaster();
    const id = handle().show({ message: 'x', duration: 0 });
    await nextTick();

    expect(handle().patch('does-not-exist', { message: 'nope' })).toBe(false);
    expect(handle().patch(id, { message: 'yep' })).toBe(true);

    app.unmount();
  });
});

describe("Toaster's 'loading' type — decorative spinner (behavioral)", () => {
  it("renders an aria-hidden spinner before the message for type: 'loading'", async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'Working…', type: 'loading', duration: 0 });
    await nextTick();

    const toast = host.querySelector('[role="status"]')!;
    const spinner = toast.querySelector('.rozie-toast-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner!.getAttribute('aria-hidden')).toBe('true');
    // Spinner precedes the message in DOM order.
    const message = toast.querySelector('.rozie-toast-message')!;
    expect(spinner!.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // liveFor('loading') is 'polite' (only error/warning are 'assertive').
    expect(toast.getAttribute('aria-live')).toBe('polite');

    app.unmount();
  });
});

describe('Toaster promise(p, { loading, success, error }) — sugar verb (behavioral)', () => {
  it('returns the id SYNCHRONOUSLY and immediately shows a loading toast', async () => {
    const { app, host, handle } = mountToaster();
    const { promise } = deferred<string>();

    const id = handle().promise(promise, {
      loading: 'Saving…',
      success: 'Saved!',
      error: 'Failed',
    });
    // No await — the id must already be a real string, synchronously.
    expect(typeof id).toBe('string');
    await nextTick();

    expect(statusCount(host)).toBe(1);
    expect(messageText(host)).toBe('Saving…');
    expect(host.querySelector('.rozie-toast--loading')).not.toBeNull();

    app.unmount();
  });

  it('on resolve, patches the SAME entry to success and starts the timer AT SETTLE', async () => {
    const { app, host, handle } = mountToaster({ duration: 300 });
    const { promise, resolve } = deferred<{ title: string }>();

    const id = handle().promise(promise, {
      loading: 'Saving…',
      success: (doc: { title: string }) => `Saved "${doc.title}"`,
      error: 'Failed',
    });
    await nextTick();

    // Let a good chunk of time pass WHILE pending — settle has not happened,
    // so no timer should be running yet (never dismisses while loading).
    await vi.advanceTimersByTimeAsync(10_000);
    await nextTick();
    expect(statusCount(host)).toBe(1);

    resolve({ title: 'My Doc' });
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();

    expect(messageText(host)).toBe('Saved "My Doc"');
    expect(host.querySelector('.rozie-toast--success')).not.toBeNull();
    expect(statusCount(host)).toBe(1); // not yet dismissed

    // The 300ms auto-dismiss timer starts AT settle, not at show.
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    await vi.advanceTimersByTimeAsync(360); // exit failsafe
    await nextTick();
    expect(statusCount(host)).toBe(0);

    void id;
    app.unmount();
  });

  it('on reject, patches to error with the function-form message receiving the reason', async () => {
    const { app, host, handle } = mountToaster();
    const { promise, reject } = deferred<unknown>();
    // Swallow the unhandled-rejection warning from the raw deferred promise
    // itself (promise() attaches its OWN .then/.catch without altering `p`).
    promise.catch(() => {});

    handle().promise(promise, {
      loading: 'Saving…',
      success: 'Saved!',
      error: (reason: unknown) => `Failed: ${(reason as Error).message}`,
    });
    await nextTick();

    reject(new Error('network down'));
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();

    expect(messageText(host)).toBe('Failed: network down');
    expect(host.querySelector('.rozie-toast--error')).not.toBeNull();

    app.unmount();
  });

  it('never resurrects a toast dismissed while its promise is still pending', async () => {
    const { app, host, handle } = mountToaster();
    const { promise, resolve } = deferred<string>();

    const id = handle().promise(promise, {
      loading: 'Saving…',
      success: 'Saved!',
      error: 'Failed',
    });
    await nextTick();
    expect(statusCount(host)).toBe(1);

    // Consumer/user dismisses it while the promise is still pending.
    handle().dismiss(id);
    await settleExit();
    expect(statusCount(host)).toBe(0);

    // NOW it settles — the settle handler must be a no-op (never-resurrect).
    resolve('too late');
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();

    expect(statusCount(host)).toBe(0);

    app.unmount();
  });

  it('the consumer can still observe rejection on its OWN promise (no derived promise swallows it)', async () => {
    const { app, handle } = mountToaster();
    const { promise, reject } = deferred<unknown>();

    handle().promise(promise, { loading: 'Saving…', success: 'Saved!', error: 'Failed' });

    let sawRejection = false;
    promise.catch(() => {
      sawRejection = true;
    });

    reject(new Error('boom'));
    await Promise.resolve();
    await Promise.resolve();

    expect(sawRejection).toBe(true);

    app.unmount();
  });
});
