// @vitest-environment happy-dom
/**
 * unique-id.behavior.test.ts — oinbox 0.8.0 follow-up (quick 261002-ekf F6): every
 * Popover's panel id used to default to `rozie-popover-panel`, because `idBase`
 * defaulted to one fixed string, so two open popovers shared an id unless the
 * consumer set `idBase` on each. Mounts the committed packages/vue/src/Popover.vue
 * leaf (the combobox token-input.behavior.test.ts precedent).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import Popover from '../packages/vue/src/Popover.vue';

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

function mount(props: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  createApp({
    render: () =>
      h(
        Popover,
        { open: true, trigger: 'click', ...props },
        { anchor: () => h('button', 'Open'), default: () => h('p', 'Panel') },
      ),
  }).mount(host);
  return host;
}

const panelId = (host: HTMLElement) => (host.querySelector('.rozie-popover-floating') as HTMLElement | null)?.id ?? null;

describe('Popover default idBase', () => {
  it('two default-configured open popovers get distinct panel ids', async () => {
    const a = mount();
    const b = mount();
    await nextTick();
    await nextTick();
    const ia = panelId(a);
    const ib = panelId(b);
    expect(ia).toMatch(/^rozie-popover-\d+-panel$/);
    expect(ib).toMatch(/^rozie-popover-\d+-panel$/);
    expect(ia).not.toBe(ib);
    // The anchor wrapper's aria-controls follows the generated id.
    expect(a.querySelector('.rozie-popover-anchor')?.getAttribute('aria-controls')).toBe(ia);
  });

  it('an explicit idBase is used as-is', async () => {
    const host = mount({ idBase: 'compose-menu' });
    await nextTick();
    expect(panelId(host)).toBe('compose-menu-panel');
  });
});
