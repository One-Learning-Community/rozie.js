// @vitest-environment happy-dom
/**
 * show-ids.behavior.test.ts — mount-and-drive contract proof for show()'s
 * id-uniqueness + no-bulk-loss guarantee (T6), on the committed Vue leaf.
 *
 * Vue writes $data synchronously, so it is immune to the React-specific
 * stale-closure bulk-loss / duplicate-id bugs — these assertions therefore
 * DOCUMENT the cross-target contract and guard against a regression that would
 * also break Vue. The React-specific lowering is locked down statically in
 * tests/react-show-emit.test.ts (the finding-authorized fallback given the
 * package has only a Vue mount harness).
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

describe('Toaster show() — distinct ids + no bulk loss (T6 contract, behavioral)', () => {
  it('two same-tick show() calls both render and get DISTINCT ids', async () => {
    const { app, host, handle } = mountToaster();

    const a = handle().show({ message: 'first', type: 'info', duration: 0 });
    const b = handle().show({ message: 'second', type: 'info', duration: 0 });
    await nextTick();

    // Neither toast is lost (bulk-loss guard).
    expect(statusCount(host)).toBe(2);
    // Ids are distinct (duplicate-id guard).
    expect(a).not.toBe(b);

    app.unmount();
  });

  it('a burst of same-tick show() calls yields all-distinct ids and no lost toasts', async () => {
    const { app, host, handle } = mountToaster();

    const ids = Array.from({ length: 5 }, (_, i) =>
      handle().show({ message: 'm' + i, type: 'info', duration: 0 }),
    );
    await nextTick();

    expect(statusCount(host)).toBe(5);
    expect(new Set(ids).size).toBe(5);

    app.unmount();
  });

  it('max drops the OLDEST while keeping the newest run intact (fresh-array slice)', async () => {
    const { app, host, handle } = mountToaster({ max: 3 });

    for (let i = 0; i < 5; i++) handle().show({ message: 'm' + i, type: 'info', duration: 0 });
    await nextTick();

    // Only the newest 3 survive.
    expect(statusCount(host)).toBe(3);
    const texts = Array.from(host.querySelectorAll('.rozie-toast-message')).map((n) => n.textContent);
    expect(texts).toEqual(['m2', 'm3', 'm4']);

    app.unmount();
  });
});
