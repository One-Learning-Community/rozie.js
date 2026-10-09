// @vitest-environment happy-dom
/**
 * live-regions.behavior.test.ts — the Toaster's standing live regions.
 *
 * Reported from dogfooding (oinbox, @rozie-ui/toast-solid 0.2.2): each
 * `.rozie-toast` row was inserted carrying `role="status"` + `aria-live`, and a
 * live region that arrives together with its content is often not announced
 * (VoiceOver especially). Now the toaster keeps a polite (`role="status"`) and
 * an assertive (`role="alert"`) region mounted for its whole life and writes
 * each toast's `message` into one of them: `error` -> the alert region, every
 * other type -> the status region. The regions are a PURE PROJECTION of the
 * toast queue (no second state, no timers); rows carry no role.
 *
 * Mounts the REAL committed emitted Vue leaf (action-data.behavior.test.ts
 * pattern) — the cross-target proof is the VR cell in toaster.spec.ts.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Toaster from '../../packages/vue/src/Toaster.vue';

interface ToasterHandle {
  show: (input?: Record<string, unknown>) => string;
  dismiss: (id: string) => void;
  patch: (id: string, changes: Record<string, unknown>) => boolean;
  promise: (p: Promise<unknown>, opts?: Record<string, unknown>) => string;
}

const hosts: HTMLElement[] = [];
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { for (const host of hosts.splice(0)) host.remove(); vi.useRealTimers(); });

function mountToaster(props?: Record<string, unknown>, slots?: Record<string, unknown>) {
  const handleRef = ref<ToasterHandle | null>(null);
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const app = createApp({
    render: () => h(Toaster, { ref: handleRef, position: 'bottom-right', ...(props ?? {}) }, slots as never),
  });
  app.mount(host);
  return { app, host, handle: () => handleRef.value as ToasterHandle };
}
const settleExit = async () => { await vi.advanceTimersByTimeAsync(400); await nextTick(); };

const POLITE = '.rozie-toaster [role="status"][aria-live="polite"]';
const ASSERTIVE = '.rozie-toaster [role="alert"][aria-live="assertive"]';
const polite = (host: HTMLElement) => host.querySelector<HTMLElement>(POLITE);
const assertive = (host: HTMLElement) => host.querySelector<HTMLElement>(ASSERTIVE);
const lines = (region: HTMLElement | null) => Array.from(region?.children ?? []) as HTMLElement[];
const text = (region: HTMLElement | null) => (region?.textContent ?? '').trim();

describe('Toaster live regions (behavioral)', () => {
  it('mounts exactly one polite and one assertive region, empty, in one wrapper, before any toast', async () => {
    const { app, host } = mountToaster();
    await nextTick();
    expect(host.querySelectorAll(POLITE).length).toBe(1);
    expect(host.querySelectorAll(ASSERTIVE).length).toBe(1);
    expect(text(polite(host))).toBe('');
    expect(text(assertive(host))).toBe('');
    const wrappers = host.querySelectorAll('.rozie-toaster-live');
    expect(wrappers.length).toBe(1);
    expect(wrappers[0]!.contains(polite(host))).toBe(true);
    expect(wrappers[0]!.contains(assertive(host))).toBe(true);
    expect(polite(host)!.getAttribute('aria-atomic')).toBe('false');
    expect(assertive(host)!.getAttribute('aria-atomic')).toBe('false');
    app.unmount();
  });

  it('keeps the SAME region elements across show, dismissal and a second show (never re-created)', async () => {
    const { app, host, handle } = mountToaster();
    await nextTick();
    const p0 = polite(host);
    const a0 = assertive(host);
    const id = handle().show({ message: 'One', type: 'success', duration: 0 });
    await nextTick();
    expect(polite(host)).toBe(p0);
    expect(assertive(host)).toBe(a0);
    handle().dismiss(id);
    await settleExit();
    expect(polite(host)).toBe(p0);
    expect(assertive(host)).toBe(a0);
    handle().show({ message: 'Two', type: 'error', duration: 0 });
    await nextTick();
    expect(polite(host)).toBe(p0);
    expect(assertive(host)).toBe(a0);
    app.unmount();
  });

  it('a success toast writes its message into the status region and leaves the alert region empty', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'Saved', type: 'success', duration: 0 });
    await nextTick();
    expect(text(polite(host))).toBe('Saved');
    expect(text(assertive(host))).toBe('');
    app.unmount();
  });

  it('an error toast writes its message into the alert region and not the status region', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'Send failed', type: 'error', duration: 0 });
    await nextTick();
    expect(text(assertive(host))).toBe('Send failed');
    expect(text(polite(host))).toBe('');
    app.unmount();
  });

  const routing: Array<[string, Record<string, unknown>, 'polite' | 'assertive']> = [
    ['info', { type: 'info' }, 'polite'],
    ['success', { type: 'success' }, 'polite'],
    ['warning', { type: 'warning' }, 'polite'],
    ['loading', { type: 'loading' }, 'polite'],
    ['an omitted type', {}, 'polite'],
    ['error', { type: 'error' }, 'assertive'],
  ];
  for (const [label, extra, region] of routing) {
    it(`${label} lands in the ${region} region only`, async () => {
      const { app, host, handle } = mountToaster();
      handle().show({ message: 'Routed', duration: 0, ...extra });
      await nextTick();
      const [hit, miss] = region === 'polite' ? [polite(host), assertive(host)] : [assertive(host), polite(host)];
      expect(text(hit)).toBe('Routed');
      expect(text(miss)).toBe('');
      app.unmount();
    });
  }

  it('toast rows carry no role and no aria-live, and no live region is an ancestor of a row', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'A', type: 'success', duration: 0 });
    handle().show({ message: 'B', type: 'error', duration: 0 });
    await nextTick();
    const rows = host.querySelectorAll<HTMLElement>('.rozie-toast');
    expect(rows.length).toBe(2);
    for (const row of Array.from(rows)) {
      expect(row.hasAttribute('role')).toBe(false);
      expect(row.hasAttribute('aria-live')).toBe(false);
      expect(row.closest('[aria-live]')).toBeNull();
      expect(row.closest('.rozie-toaster-live')).toBeNull();
      // The only role-bearing ancestor is the root landmark.
      expect(row.parentElement!.getAttribute('role')).toBe('region');
      expect(row.parentElement!.parentElement!.closest('[role]')).toBeNull();
    }
    app.unmount();
  });

  it('two toasts with the identical message produce two distinct lines', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ message: 'Same', type: 'info', duration: 0 });
    handle().show({ message: 'Same', type: 'info', duration: 0 });
    await nextTick();
    const ls = lines(polite(host));
    expect(ls.length).toBe(2);
    expect(ls[0]).not.toBe(ls[1]);
    expect(ls.map((l) => l.textContent?.trim())).toEqual(['Same', 'Same']);
    app.unmount();
  });

  it('patch() rewrites the SAME line element in place when only the message changes', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'Working', type: 'info', duration: 0 });
    await nextTick();
    const before = lines(polite(host))[0]!;
    expect(handle().patch(id, { message: 'Done' })).toBe(true);
    await nextTick();
    const after = lines(polite(host));
    expect(after.length).toBe(1);
    expect(after[0]).toBe(before);
    expect(after[0]!.textContent?.trim()).toBe('Done');
    app.unmount();
  });

  it('patch() to type "error" moves the line from the status region to the alert region', async () => {
    const { app, host, handle } = mountToaster();
    const id = handle().show({ message: 'Working', type: 'info', duration: 0 });
    await nextTick();
    expect(lines(polite(host)).length).toBe(1);
    expect(lines(assertive(host)).length).toBe(0);
    expect(handle().patch(id, { type: 'error', message: 'Failed' })).toBe(true);
    await nextTick();
    expect(lines(polite(host)).length).toBe(0);
    expect(lines(assertive(host)).length).toBe(1);
    expect(text(assertive(host))).toBe('Failed');
    app.unmount();
  });

  it('promise(): loading text in the status region; success replaces it there', async () => {
    const { app, host, handle } = mountToaster();
    let resolve!: (v: unknown) => void;
    const p = new Promise((r) => { resolve = r; });
    handle().promise(p, { loading: 'Saving…', success: 'Saved', error: 'Nope' });
    await nextTick();
    expect(text(polite(host))).toBe('Saving…');
    expect(text(assertive(host))).toBe('');
    resolve(1);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(text(polite(host))).toBe('Saved');
    expect(text(assertive(host))).toBe('');
    app.unmount();
  });

  it('promise(): a rejection puts the error text in the alert region', async () => {
    const { app, host, handle } = mountToaster();
    let reject!: (e: unknown) => void;
    const p = new Promise((_r, rej) => { reject = rej; });
    p.catch(() => {});
    handle().promise(p, { loading: 'Saving…', success: 'Saved', error: 'Failed to save' });
    await nextTick();
    expect(text(polite(host))).toBe('Saving…');
    reject(new Error('boom'));
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(text(assertive(host))).toBe('Failed to save');
    expect(text(polite(host))).toBe('');
    app.unmount();
  });

  it('after dismissal settles the line is gone and both region elements remain', async () => {
    const { app, host, handle } = mountToaster();
    const p0 = polite(host);
    const a0 = assertive(host);
    const id = handle().show({ message: 'Bye', type: 'success', duration: 0 });
    await nextTick();
    expect(lines(polite(host)).length).toBe(1);
    handle().dismiss(id);
    await settleExit();
    expect(lines(polite(host)).length).toBe(0);
    expect(lines(assertive(host)).length).toBe(0);
    expect(polite(host)).toBe(p0);
    expect(assertive(host)).toBe(a0);
    app.unmount();
  });

  it('a toast with an empty message adds no line', async () => {
    const { app, host, handle } = mountToaster();
    handle().show({ type: 'info', duration: 0 });
    handle().show({ message: '', type: 'error', duration: 0 });
    await nextTick();
    expect(lines(polite(host)).length).toBe(0);
    expect(lines(assertive(host)).length).toBe(0);
    app.unmount();
  });

  describe('a toast with no message text keeps a live role on its own row', () => {
    const row = (host: HTMLElement) => host.querySelector<HTMLElement>('.rozie-toast');

    it('an error toast with no message gets role="alert" on its row, no aria-live, and no region line', async () => {
      const { app, host, handle } = mountToaster();
      handle().show({ data: { who: 'x' }, type: 'error', duration: 0 });
      await nextTick();
      expect(row(host)!.getAttribute('role')).toBe('alert');
      expect(row(host)!.hasAttribute('aria-live')).toBe(false);
      expect(lines(polite(host)).length).toBe(0);
      expect(lines(assertive(host)).length).toBe(0);
      app.unmount();
    });

    for (const type of ['info', 'success', 'warning', 'loading', undefined]) {
      it(`${type ?? 'an omitted type'} with no message gets role="status" on its row`, async () => {
        const { app, host, handle } = mountToaster();
        handle().show({ duration: 0, ...(type ? { type } : {}) });
        await nextTick();
        expect(row(host)!.getAttribute('role')).toBe('status');
        expect(row(host)!.hasAttribute('aria-live')).toBe(false);
        expect(lines(polite(host)).length).toBe(0);
        app.unmount();
      });
    }

    it('a whitespace-only message counts as no message', async () => {
      const { app, host, handle } = mountToaster();
      handle().show({ message: '   ', type: 'error', duration: 0 });
      await nextTick();
      expect(row(host)!.getAttribute('role')).toBe('alert');
      expect(lines(assertive(host)).length).toBe(0);
      app.unmount();
    });

    it('a toast WITH a message keeps a role-less row (text in the standing region)', async () => {
      const { app, host, handle } = mountToaster();
      handle().show({ message: 'Hi', type: 'error', duration: 0 });
      await nextTick();
      expect(row(host)!.hasAttribute('role')).toBe(false);
      expect(text(assertive(host))).toBe('Hi');
      app.unmount();
    });

    it('disableAnnounce adds no role to a message-less row either', async () => {
      const { app, host, handle } = mountToaster({ disableAnnounce: true });
      handle().show({ type: 'error', duration: 0 });
      await nextTick();
      expect(row(host)!.hasAttribute('role')).toBe(false);
      expect(host.querySelector('[role="alert"],[role="status"]')).toBeNull();
      app.unmount();
    });

    it('patch() giving an empty toast a message moves it to the region and drops the row role; clearing it reverses', async () => {
      const { app, host, handle } = mountToaster();
      const id = handle().show({ type: 'info', duration: 0 });
      await nextTick();
      expect(row(host)!.getAttribute('role')).toBe('status');
      handle().patch(id, { message: 'Now with text' });
      await nextTick();
      expect(row(host)!.hasAttribute('role')).toBe(false);
      expect(text(polite(host))).toBe('Now with text');
      handle().patch(id, { message: '' });
      await nextTick();
      expect(row(host)!.getAttribute('role')).toBe('status');
      expect(lines(polite(host)).length).toBe(0);
      app.unmount();
    });

    it('patch() of the type on an empty toast switches the row role between alert and status', async () => {
      const { app, host, handle } = mountToaster();
      const id = handle().show({ type: 'info', duration: 0 });
      await nextTick();
      expect(row(host)!.getAttribute('role')).toBe('status');
      handle().patch(id, { type: 'error' });
      await nextTick();
      expect(row(host)!.getAttribute('role')).toBe('alert');
      app.unmount();
    });

    it('promise() whose success message function returns "" leaves the settled toast announced via its row', async () => {
      const { app, host, handle } = mountToaster();
      let resolve!: (v: unknown) => void;
      const p = new Promise((r) => { resolve = r; });
      handle().promise(p, { loading: 'Saving…', success: () => '', error: 'Nope' });
      await nextTick();
      expect(row(host)!.hasAttribute('role')).toBe(false);
      expect(text(polite(host))).toBe('Saving…');
      resolve(1);
      await vi.advanceTimersByTimeAsync(0);
      await nextTick();
      expect(row(host)!.getAttribute('role')).toBe('status');
      expect(lines(polite(host)).length).toBe(0);
      app.unmount();
    });
  });

  it('disableAnnounce renders no live regions at all, so a role in the #toast slot is the only live region', async () => {
    const { app, host, handle } = mountToaster(
      { disableAnnounce: true },
      { toast: ({ toast }: { toast: { message: string } }) => h('div', { role: 'alert', class: 'mine' }, toast.message) },
    );
    await nextTick();
    expect(host.querySelector('.rozie-toaster-live')).toBeNull();
    expect(host.querySelector('[aria-live]')).toBeNull();
    handle().show({ message: 'Custom', type: 'error', duration: 0 });
    await nextTick();
    expect(host.querySelector('.rozie-toaster-live')).toBeNull();
    expect(host.querySelector('[aria-live]')).toBeNull();
    const alerts = host.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(1);
    expect((alerts[0] as HTMLElement).classList.contains('mine')).toBe(true);
    expect(alerts[0]!.closest('[aria-live]')).toBeNull();
    // the toaster itself contributes no role=status either
    expect(host.querySelector('[role="status"]')).toBeNull();
    app.unmount();
  });
});
