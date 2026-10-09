// @vitest-environment happy-dom
/**
 * disable-positioning-inline-styles.behavior.test.ts — when `disablePositioning`
 * turns ON while the panel is open, the inline geometry the positioning code wrote
 * (`left` / `top`, an inline `position: fixed` for `strategy="fixed"`, the
 * `matchWidth` `width`) must not stay on the panel: the `--static` class resets
 * `left` / `top` / `width` / `position` with class specificity, which an inline
 * declaration beats, so a stale value would leave the "inline" panel stuck at its
 * old floating coordinates. Mounts the committed packages/vue/src/Popover.vue leaf
 * (the available-width.behavior.test.ts precedent).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import Popover from '../packages/vue/src/Popover.vue';

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
  vi.restoreAllMocks();
});

const settle = async () => {
  for (let i = 0; i < 6; i++) {
    await nextTick();
    await new Promise<void>((r) => setTimeout(r, 0));
  }
};

async function mount(initial: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const props = reactive<Record<string, unknown>>({ open: true, trigger: 'click', ...initial });
  createApp({
    render: () =>
      h(
        Popover,
        { ...props, 'onUpdate:open': (v: boolean) => (props.open = v) },
        { anchor: () => h('button', 'Open'), default: () => h('p', 'Panel') },
      ),
  }).mount(host);
  await settle();
  const panel = () => host.querySelector('.rozie-popover-floating') as HTMLElement | null;
  return { props, panel };
}

/** Give every element a non-zero box so Floating UI resolves real, non-empty coordinates. */
function stubGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const isPanel = this.classList.contains('rozie-popover-floating');
    const w = isPanel ? 120 : 240;
    return { x: 40, y: 60, left: 40, top: 60, right: 40 + w, bottom: 60 + 24, width: w, height: 24, toJSON() {} } as DOMRect;
  });
}

describe('disablePositioning turning on while open clears the inline geometry', () => {
  it('P0 control: an open, tracked panel carries inline left/top', async () => {
    stubGeometry();
    const { panel } = await mount();
    expect(panel()!.style.left).not.toBe('');
    expect(panel()!.style.top).not.toBe('');
  });

  it('P1 left and top are cleared', async () => {
    stubGeometry();
    const { props, panel } = await mount();
    expect(panel()!.style.left).not.toBe('');
    props.disablePositioning = true;
    await settle();
    expect(panel()!.classList.contains('rozie-popover-floating--static')).toBe(true);
    expect(panel()!.style.left).toBe('');
    expect(panel()!.style.top).toBe('');
  });

  it('P2 an inline position: fixed (strategy="fixed") is cleared', async () => {
    stubGeometry();
    const { props, panel } = await mount({ strategy: 'fixed' });
    expect(panel()!.style.position).toBe('fixed');
    props.disablePositioning = true;
    await settle();
    expect(panel()!.style.position).toBe('');
  });

  it('P3 the matchWidth width is cleared', async () => {
    stubGeometry();
    const { props, panel } = await mount({ matchWidth: true });
    expect(panel()!.style.width).not.toBe('');
    props.disablePositioning = true;
    await settle();
    expect(panel()!.style.width).toBe('');
  });

  it('P4 turning it back off re-positions the panel', async () => {
    stubGeometry();
    const { props, panel } = await mount();
    props.disablePositioning = true;
    await settle();
    props.disablePositioning = false;
    await settle();
    expect(panel()!.style.left).not.toBe('');
    expect(panel()!.style.top).not.toBe('');
  });

  it('P5 a panel mounted with disablePositioning never gets inline geometry', async () => {
    stubGeometry();
    const { panel } = await mount({ disablePositioning: true });
    expect(panel()!.style.left).toBe('');
    expect(panel()!.style.top).toBe('');
    expect(panel()!.style.position).toBe('');
  });
});
