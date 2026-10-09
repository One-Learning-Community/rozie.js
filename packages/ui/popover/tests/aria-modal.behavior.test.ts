// @vitest-environment happy-dom
/**
 * aria-modal.behavior.test.ts — quick 261008-mms. oinbox axe `aria-allowed-attr`
 * (critical) report: the floating panel rendered `aria-modal="false"` on every
 * non-dialog panel (default click, `bare`, `role="tooltip"`). `aria-modal` is only
 * allowed on dialog roles, so the attribute must be OMITTED unless the panel is a
 * dialog. Mounts the committed packages/vue/src/Popover.vue leaf (the
 * unique-id.behavior.test.ts precedent).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, nextTick, type VNodeChild } from 'vue';
import Popover from '../packages/vue/src/Popover.vue';

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

async function mount(
  props: Record<string, unknown> = {},
  content: () => VNodeChild = () => h('p', 'Panel'),
) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  createApp({
    render: () =>
      h(
        Popover,
        { open: true, trigger: 'click', ...props },
        { anchor: () => h('button', 'Open'), default: content },
      ),
  }).mount(host);
  await nextTick();
  await nextTick();
  return host;
}

const panelOf = (host: HTMLElement) => host.querySelector('.rozie-popover-floating') as HTMLElement;

describe('Popover panel aria-modal', () => {
  it('B1: a default click popover panel has no aria-modal and no role', async () => {
    const panel = panelOf(await mount());
    expect(panel).not.toBeNull();
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    expect(panel.hasAttribute('role')).toBe(false);
  });

  it('B2: a bare popover hosting the consumer\'s own role="dialog" card keeps the panel role-neutral', async () => {
    const host = await mount({ bare: true }, () => h('div', { role: 'dialog', class: 'card' }, 'Card'));
    const panel = panelOf(host);
    expect(panel.classList.contains('rozie-popover-floating--bare')).toBe(true);
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    expect(panel.hasAttribute('role')).toBe(false);
    expect(panel.querySelector('.card')?.getAttribute('role')).toBe('dialog');
  });

  it('B3: a hover tooltip panel has role="tooltip" and no aria-modal', async () => {
    const panel = panelOf(await mount({ trigger: 'hover' }));
    expect(panel.getAttribute('role')).toBe('tooltip');
    expect(panel.hasAttribute('aria-modal')).toBe(false);
  });

  it('B4: a modal click popover panel keeps role="dialog" + aria-modal="true"', async () => {
    const panel = panelOf(await mount({ modal: true }));
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
  });
});
