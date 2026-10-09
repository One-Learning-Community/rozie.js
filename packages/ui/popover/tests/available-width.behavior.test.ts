// @vitest-environment happy-dom
/**
 * available-width.behavior.test.ts — review finding B on quick 261008-mmt. The
 * width-limit `size` middleware publishes `--rozie-popover-available-width` on the
 * panel. The property must not outlive the tracking that measured it: it is removed
 * wherever positioning stops (`disableShift`, `disablePositioning`, close). Mounts the
 * committed packages/vue/src/Popover.vue leaf (the aria-modal.behavior.test.ts
 * precedent), driving props through a reactive wrapper.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import Popover from '../packages/vue/src/Popover.vue';

const PROP = '--rozie-popover-available-width';
const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
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

describe('--rozie-popover-available-width lifecycle', () => {
  it('C0 control: an open, tracked panel carries the measured width', async () => {
    const { panel } = await mount({ keepMounted: true });
    expect(panel()!.style.getPropertyValue(PROP)).not.toBe('');
  });

  it('C1 disableShift turning on removes it', async () => {
    const { props, panel } = await mount();
    expect(panel()!.style.getPropertyValue(PROP)).not.toBe('');
    props.disableShift = true;
    await settle();
    expect(panel()!.style.getPropertyValue(PROP)).toBe('');
  });

  it('C2 disablePositioning turning on removes it', async () => {
    const { props, panel } = await mount();
    expect(panel()!.style.getPropertyValue(PROP)).not.toBe('');
    props.disablePositioning = true;
    await settle();
    expect(panel()!.style.getPropertyValue(PROP)).toBe('');
  });

  it('C3 closing a keepMounted panel removes it', async () => {
    const { props, panel } = await mount({ keepMounted: true });
    expect(panel()!.style.getPropertyValue(PROP)).not.toBe('');
    props.open = false;
    await settle();
    expect(panel()!.style.getPropertyValue(PROP)).toBe('');
  });

  it('C4 re-opening re-measures and writes it again', async () => {
    const { props, panel } = await mount({ keepMounted: true });
    props.open = false;
    await settle();
    props.open = true;
    await settle();
    expect(panel()!.style.getPropertyValue(PROP)).not.toBe('');
  });

  it('C5 turning disablePositioning back off resumes measuring', async () => {
    const { props, panel } = await mount();
    props.disablePositioning = true;
    await settle();
    props.disablePositioning = false;
    await settle();
    expect(panel()!.style.getPropertyValue(PROP)).not.toBe('');
  });
});
