// @vitest-environment happy-dom
/**
 * token-input.behavior.test.ts — mount-and-drive behavioral proof for the
 * release-0.8.0 token-input surface (COMBOBOX-SPEC): the B4/B9/B10/B12 behavior
 * fixes and the `block` / `chipLayout` / `disableOpenOnFocus` / `hideEmpty` /
 * `delimiters` / paste / `validate` / `selectOnTab` / `activeOption()` additions.
 *
 * Mirrors multiple.behavior.test.ts / seed-query.behavior.test.ts: mount the
 * REAL committed emitted packages/vue/src/Combobox.vue, drive it with real DOM
 * events, assert on DOM + the two-way `value` model + the `change` log.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Combobox from '../packages/vue/src/Combobox.vue';

const OPTIONS = [
  { value: 'ann@x.io', label: 'Ann' },
  { value: 'bob@x.io', label: 'Bob' },
  { value: 'cat@x.io', label: 'Cat' },
];

interface Handle {
  activeOption: () => unknown;
  focus: () => void;
}

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

function mount(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  const value = ref<unknown>(props.value ?? null);
  const changes: Array<Record<string, unknown>> = [];
  const handleRef = ref<Handle | null>(null);
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const { value: _ignored, ...rest } = props;
  const app = createApp({
    render: () =>
      h(
        Combobox,
        {
          ref: handleRef,
          value: value.value,
          'onUpdate:value': (v: unknown) => {
            value.value = v;
          },
          onChange: (e: Record<string, unknown>) => changes.push(e),
          options: OPTIONS,
          ariaLabel: 'To',
          idBase: 'token-test',
          ...rest,
        },
        slots,
      ),
  });
  app.mount(host);
  const input = host.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { host, input, changes, value: () => value.value, handle: () => handleRef.value as Handle };
}

async function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await nextTick();
}

async function key(input: HTMLInputElement, k: string, init: Record<string, unknown> = {}) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  input.dispatchEvent(ev);
  await nextTick();
  return ev;
}

async function paste(input: HTMLInputElement, text: string) {
  let prevented = false;
  const ev = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
    clipboardData: { getData: (t: string) => string };
  };
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
  const origPD = ev.preventDefault.bind(ev);
  ev.preventDefault = () => {
    prevented = true;
    origPD();
  };
  input.dispatchEvent(ev);
  await nextTick();
  return prevented;
}

const list = (host: HTMLElement) => host.querySelector('.rozie-combobox-list');

describe('Combobox token input — behavior fixes', () => {
  it('B9: Ctrl/Meta/Alt+Enter never picks; plain Enter still does', async () => {
    const m = mount();
    await type(m.input, 'a');
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
      const ev = await key(m.input, 'Enter', { [mod]: true });
      expect(ev.defaultPrevented).toBe(false);
      expect(m.value()).toBe(null);
    }
    const ev = await key(m.input, 'Enter');
    expect(ev.defaultPrevented).toBe(true);
    expect(m.value()).toBe('ann@x.io');
  });

  it('B10: keydown during IME composition (isComposing / keyCode 229) is ignored', async () => {
    const m = mount();
    await type(m.input, 'a');
    const ev1 = await key(m.input, 'Enter', { isComposing: true });
    expect(ev1.defaultPrevented).toBe(false);
    const ev2 = await key(m.input, 'Enter', { keyCode: 229 });
    expect(ev2.defaultPrevented).toBe(false);
    const ev3 = await key(m.input, 'ArrowDown', { isComposing: true });
    expect(ev3.defaultPrevented).toBe(false);
    expect(m.value()).toBe(null);
    expect(m.changes).toHaveLength(0);
  });

  it('B12: the chip slot remove() removes the chip and refocuses the input', async () => {
    let removeFn: (() => void) | null = null;
    const m = mount(
      { multiple: true, value: ['ann@x.io', 'bob@x.io'] },
      {
        chip: (p: { option: unknown; remove: () => void; index: number }) => {
          if (p.index === 0) removeFn = p.remove;
          return h('button', { class: 'my-chip', onClick: () => p.remove() }, 'x');
        },
      },
    );
    await nextTick();
    const chipBtn = m.host.querySelector('.my-chip') as HTMLButtonElement;
    expect(chipBtn).toBeTruthy();
    chipBtn.focus();
    expect(document.activeElement).toBe(chipBtn);
    expect(removeFn).toBeTypeOf('function');
    chipBtn.click();
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(m.value()).toEqual(['bob@x.io']);
    expect(document.activeElement).toBe(m.input);
  });

  it('B4 + hideEmpty: nothing to show ⇒ no list, aria-expanded false, Escape not consumed', async () => {
    const m = mount({ hideEmpty: true });
    await type(m.input, 'zzz');
    expect(list(m.host)).toBeNull();
    expect(m.input.getAttribute('aria-expanded')).toBe('false');
    const ev = await key(m.input, 'Escape');
    expect(ev.defaultPrevented).toBe(false);
    // Options matching ⇒ visible again.
    await type(m.input, 'b');
    expect(list(m.host)).not.toBeNull();
    expect(m.input.getAttribute('aria-expanded')).toBe('true');
  });

  it('without hideEmpty the empty popup still shows and Escape IS consumed (unchanged)', async () => {
    const m = mount();
    await type(m.input, 'zzz');
    expect(list(m.host)).not.toBeNull();
    expect(m.host.querySelector('.rozie-combobox-empty')).not.toBeNull();
    expect(m.input.getAttribute('aria-expanded')).toBe('true');
    const ev = await key(m.input, 'Escape');
    expect(ev.defaultPrevented).toBe(true);
    expect(list(m.host)).toBeNull();
  });
});

describe('Combobox token input — new props', () => {
  it('disableOpenOnFocus: focus does not open; ArrowDown does', async () => {
    const m = mount({ disableOpenOnFocus: true });
    m.input.dispatchEvent(new Event('focus'));
    await nextTick();
    await Promise.resolve();
    expect(list(m.host)).toBeNull();
    await key(m.input, 'ArrowDown');
    expect(list(m.host)).not.toBeNull();
  });

  it('default focus still opens the list (byte-identical-off)', async () => {
    const m = mount();
    m.input.dispatchEvent(new Event('focus'));
    await nextTick();
    expect(list(m.host)).not.toBeNull();
  });

  it('delimiters: "," commits the TYPED text (not the highlighted option); duplicates skipped', async () => {
    const m = mount({ multiple: true, delimiters: [',', ';'] });
    await type(m.input, 'Ann');
    // "Ann" highlights the Ann option, but ',' commits the typed text.
    const ev = await key(m.input, ',');
    expect(ev.defaultPrevented).toBe(true);
    expect(m.value()).toEqual(['Ann']);
    expect(m.changes).toEqual([{ value: ['Ann'], option: null, selected: true, text: 'Ann' }]);
    expect(m.input.value).toBe('');
    await type(m.input, ' Ann ');
    await key(m.input, ';');
    expect(m.value()).toEqual(['Ann']);
    expect(m.changes).toHaveLength(1);
  });

  it('delimiters are ignored without multiple', async () => {
    const m = mount({ delimiters: [','] });
    await type(m.input, 'Ann');
    const ev = await key(m.input, ',');
    expect(ev.defaultPrevented).toBe(false);
    expect(m.value()).toBe(null);
  });

  it('Enter with no highlighted option commits typed text when delimiters or validate is set', async () => {
    const a = mount({ multiple: true, delimiters: [','] });
    await type(a.input, 'dan@x.io');
    expect(a.host.querySelectorAll('.rozie-combobox-option').length).toBe(0);
    const ev = await key(a.input, 'Enter');
    expect(ev.defaultPrevented).toBe(true);
    expect(a.value()).toEqual(['dan@x.io']);

    const b = mount({ multiple: true, validate: () => true });
    await type(b.input, 'eve@x.io');
    await key(b.input, 'Enter');
    expect(b.value()).toEqual(['eve@x.io']);
    expect(b.changes[0]).toEqual({ value: ['eve@x.io'], option: null, selected: true, text: 'eve@x.io' });
  });

  it('Enter with a highlighted option still picks it in free-text mode', async () => {
    const m = mount({ multiple: true, delimiters: [','] });
    await type(m.input, 'Bo');
    await key(m.input, 'Enter');
    expect(m.value()).toEqual(['bob@x.io']);
    expect(m.changes[0].option).toEqual(OPTIONS[1]);
    expect(m.changes[0].text).toBeUndefined();
  });

  it('Enter with no highlight and neither delimiters nor validate commits nothing (off)', async () => {
    const m = mount({ multiple: true });
    await type(m.input, 'dan@x.io');
    const ev = await key(m.input, 'Enter');
    expect(ev.defaultPrevented).toBe(false);
    expect(m.value()).toBe(null);
    expect(m.changes).toHaveLength(0);
  });

  it('paste with delimiters splits and commits every trimmed part', async () => {
    const m = mount({ multiple: true, delimiters: [',', ';'] });
    const prevented = await paste(m.input, ' a@x.io, b@x.io ;c@x.io,, ');
    expect(prevented).toBe(true);
    expect(m.value()).toEqual(['a@x.io', 'b@x.io', 'c@x.io']);
    expect(m.changes.map((c) => c.text)).toEqual(['a@x.io', 'b@x.io', 'c@x.io']);
    expect(m.changes[2].value).toEqual(['a@x.io', 'b@x.io', 'c@x.io']);
  });

  it('paste with no delimiter is ordinary text (not prevented)', async () => {
    const m = mount({ multiple: true, delimiters: [','] });
    const prevented = await paste(m.input, 'a@x.io');
    expect(prevented).toBe(false);
    expect(m.value()).toBe(null);
  });

  it('validate rejects: text stays in the input, no change', async () => {
    const isEmail = (t: string) => /^\S+@\S+$/.test(t);
    const m = mount({ multiple: true, delimiters: [','], validate: isEmail });
    await type(m.input, 'notanemail');
    await key(m.input, ',');
    expect(m.value()).toBe(null);
    expect(m.changes).toHaveLength(0);
    expect(m.input.value).toBe('notanemail');
    // Paste: accepted parts commit, rejected stay in the input.
    await paste(m.input, 'ok@x.io, bad');
    expect(m.value()).toEqual(['ok@x.io']);
    expect(m.input.value).toBe('bad');
  });

  it('selectOnTab picks the highlighted option and prevents default', async () => {
    const m = mount({ selectOnTab: true });
    await type(m.input, 'Ca');
    const ev = await key(m.input, 'Tab');
    expect(ev.defaultPrevented).toBe(true);
    expect(m.value()).toBe('cat@x.io');
  });

  it('Tab without selectOnTab is not prevented and picks nothing', async () => {
    const m = mount();
    await type(m.input, 'Ca');
    const ev = await key(m.input, 'Tab');
    expect(ev.defaultPrevented).toBe(false);
    expect(m.value()).toBe(null);
  });

  it('selectOnTab with nothing highlighted is not prevented', async () => {
    const m = mount({ selectOnTab: true });
    await type(m.input, 'zzz');
    const ev = await key(m.input, 'Tab');
    expect(ev.defaultPrevented).toBe(false);
  });

  it('activeOption() returns the highlighted raw option, or null', async () => {
    const m = mount();
    expect(m.handle().activeOption()).toBe(null);
    await type(m.input, 'b');
    expect(m.handle().activeOption()).toEqual(OPTIONS[1]);
    await key(m.input, 'Escape');
    expect(m.handle().activeOption()).toBe(null);
  });

  it('block / chipLayout="inline" add the root modifier classes', async () => {
    const root = (host: HTMLElement) => host.querySelector('.rozie-combobox') as HTMLElement;
    const plain = mount();
    expect(root(plain.host).classList.contains('rozie-combobox--block')).toBe(false);
    expect(root(plain.host).classList.contains('rozie-combobox--chips-inline')).toBe(false);
    const block = mount({ block: true });
    expect(root(block.host).classList.contains('rozie-combobox--block')).toBe(true);
    const inlineSingle = mount({ chipLayout: 'inline' });
    expect(root(inlineSingle.host).classList.contains('rozie-combobox--chips-inline')).toBe(false);
    const inlineMulti = mount({ chipLayout: 'inline', multiple: true });
    expect(root(inlineMulti.host).classList.contains('rozie-combobox--chips-inline')).toBe(true);
  });
});
