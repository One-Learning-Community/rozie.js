// @vitest-environment happy-dom
/**
 * wiring.behavior.test.ts — the accessibility wiring and the model/event
 * behaviour, asserted on a mounted component (not just the compiled text).
 * Mounts the committed packages/vue/src/TextField.vue leaf (the popover
 * aria-modal.behavior.test.ts precedent). Cross-target parity is the VR cells'
 * job; this pins the contract once.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, nextTick, ref, type Ref } from 'vue';
import TextField from '../packages/vue/src/TextField.vue';

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

interface Mounted {
  host: HTMLElement;
  model: Ref<string>;
  events: { name: string; payload: unknown }[];
  props: Ref<Record<string, unknown>>;
}

async function mount(
  initial: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {},
  hostTag: 'div' | 'form' = 'div',
): Promise<Mounted> {
  // A form host sits in a wrapper: happy-dom's HTMLFormElement.remove() throws.
  const wrapper = document.createElement('div');
  const host = hostTag === 'div' ? wrapper : wrapper.appendChild(document.createElement(hostTag));
  document.body.appendChild(wrapper);
  hosts.push(wrapper);
  const model = ref('');
  const props = ref<Record<string, unknown>>(initial);
  const events: { name: string; payload: unknown }[] = [];
  createApp({
    render: () =>
      h(
        TextField,
        {
          ...props.value,
          modelValue: model.value,
          'onUpdate:modelValue': (v: string) => (model.value = v),
          onChange: (p: unknown) => events.push({ name: 'change', payload: p }),
          onEnter: (p: unknown) => events.push({ name: 'enter', payload: p }),
        },
        slots,
      ),
  }).mount(host);
  await nextTick();
  await nextTick();
  return { host, model, events, props };
}

const control = (host: HTMLElement) =>
  host.querySelector('.rozie-text-field-input') as HTMLInputElement | HTMLTextAreaElement;

describe('TextField labelling', () => {
  it('points the label at the control through a generated id', async () => {
    const { host } = await mount({ label: 'Email' });
    const label = host.querySelector('label') as HTMLLabelElement;
    const input = control(host);
    expect(input.id).toMatch(/^rozie-text-field-\d+-input$/);
    expect(label.getAttribute('for')).toBe(input.id);
    expect(label.textContent).toBe('Email');
  });

  it('gives two instances distinct ids', async () => {
    const a = control((await mount({ label: 'A' })).host);
    const b = control((await mount({ label: 'B' })).host);
    expect(a.id).not.toBe(b.id);
  });

  it('keeps distinct ids when idBase is cleared after mount', async () => {
    const a = await mount({ idBase: 'fixed' });
    const b = await mount({ idBase: 'fixed' });
    a.props.value = { idBase: '' };
    b.props.value = { idBase: '' };
    await nextTick();
    expect(control(a.host).id).toMatch(/^rozie-text-field-\d+-input$/);
    expect(control(a.host).id).not.toBe(control(b.host).id);
  });

  it('uses idBase for stable ids', async () => {
    const { host } = await mount({ label: 'Name', idBase: 'signup-name', description: 'Your full name' });
    expect(control(host).id).toBe('signup-name-input');
    expect(host.querySelector('.rozie-text-field-description')?.id).toBe('signup-name-description');
  });

  it('renders no label element without a label, and applies ariaLabel', async () => {
    const { host } = await mount({ ariaLabel: 'Search' });
    expect(host.querySelector('label')).toBeNull();
    expect(control(host).getAttribute('aria-label')).toBe('Search');
  });

  it('marks required with the native attribute and an aria-hidden asterisk', async () => {
    const { host } = await mount({ label: 'Email', required: true });
    expect(control(host).required).toBe(true);
    expect(host.querySelector('.rozie-text-field-required')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('TextField describedby and invalid state', () => {
  it('has no aria-describedby and no aria-invalid by default', async () => {
    const { host } = await mount({ label: 'Email' });
    expect(control(host).hasAttribute('aria-describedby')).toBe(false);
    expect(control(host).hasAttribute('aria-invalid')).toBe(false);
  });

  it('links description, error and counter in order, and flags invalid on error', async () => {
    const { host } = await mount({
      label: 'Email',
      idBase: 'f',
      description: 'We never share it.',
      error: 'Enter a valid email address.',
      showCount: true,
    });
    const input = control(host);
    expect(input.getAttribute('aria-describedby')).toBe('f-description f-error f-count');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('#f-error')?.textContent).toBe('Enter a valid email address.');
    expect(host.querySelector('.rozie-text-field')?.classList.contains('rozie-text-field--invalid')).toBe(true);
  });

  it('drops the error link and aria-invalid when the error clears', async () => {
    const m = await mount({ idBase: 'f', error: 'Required' });
    m.props.value = { idBase: 'f', error: '' };
    await nextTick();
    expect(control(m.host).hasAttribute('aria-invalid')).toBe(false);
    expect(control(m.host).hasAttribute('aria-describedby')).toBe(false);
    expect(m.host.querySelector('#f-error')).toBeNull();
  });

  it('invalid without a message flags the control but renders no error text', async () => {
    const { host } = await mount({ invalid: true });
    expect(control(host).getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('.rozie-text-field-error')).toBeNull();
  });
});

describe('TextField value, events and counter', () => {
  it('writes modelValue on input and reflects programmatic writes', async () => {
    const m = await mount({ label: 'Name' });
    const input = control(m.host);
    input.value = 'Ada';
    input.dispatchEvent(new Event('input'));
    await nextTick();
    expect(m.model.value).toBe('Ada');

    m.model.value = 'Grace';
    await nextTick();
    expect(control(m.host).value).toBe('Grace');
  });

  it('emits change on the DOM change event, not while typing', async () => {
    const m = await mount();
    const input = control(m.host);
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    input.value = 'xy';
    input.dispatchEvent(new Event('input'));
    expect(m.events).toEqual([]);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.events).toEqual([{ name: 'change', payload: { value: 'xy' } }]);
  });

  it('a programmatic write does not emit change', async () => {
    const m = await mount();
    m.model.value = 'from the app';
    await nextTick();
    expect(control(m.host).value).toBe('from the app');
    expect(m.events).toEqual([]);
  });

  it('stops the native change event at the control', async () => {
    const m = await mount();
    let bubbled = 0;
    m.host.addEventListener('change', () => bubbled++);
    control(m.host).dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.events).toHaveLength(1);
    expect(bubbled).toBe(0);
  });

  it('emits enter on Enter, but not during IME composition', async () => {
    const m = await mount();
    const input = control(m.host);
    input.value = 'go';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    // Safari's composition-confirming Enter: isComposing false, keyCode 229.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229 }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(m.events).toEqual([{ name: 'enter', payload: { value: 'go' } }]);
  });

  it('follows a form reset: the model takes the reset value', async () => {
    const m = await mount({ name: 'note' }, {}, 'form');
    const input = control(m.host);
    input.value = 'draft';
    input.dispatchEvent(new Event('input'));
    await nextTick();
    expect(m.model.value).toBe('draft');
    // What form.reset() does to a control whose value was set as a property
    // (happy-dom's reset() does not): it empties it, with no input event.
    m.host.dispatchEvent(new Event('reset'));
    input.value = '';
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    expect(m.model.value).toBe('');
  });

  it('counts characters against maxLength and forwards maxlength', async () => {
    const m = await mount({ showCount: true, maxLength: 10 });
    expect(control(m.host).getAttribute('maxlength')).toBe('10');
    m.model.value = 'hello';
    await nextTick();
    expect(m.host.querySelector('.rozie-text-field-count')?.textContent).toBe('5 / 10');
  });

  it('forwards type, placeholder, name and autocomplete, omitting empty ones', async () => {
    const { host } = await mount({ type: 'email', placeholder: 'you@example.com', name: 'email' });
    const input = control(host) as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.getAttribute('placeholder')).toBe('you@example.com');
    expect(input.getAttribute('name')).toBe('email');
    expect(input.hasAttribute('autocomplete')).toBe(false);
  });
});

describe('TextField multiline and slots', () => {
  it('renders a textarea with rows when multiline', async () => {
    const { host } = await mount({ multiline: true, rows: 5, label: 'Notes' });
    const ta = control(host);
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.getAttribute('rows')).toBe('5');
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('label')?.getAttribute('for')).toBe(ta.id);
  });

  it('autosize writes an explicit height on input', async () => {
    const m = await mount({ multiline: true, autosize: true });
    const ta = control(m.host) as HTMLTextAreaElement;
    ta.value = 'a\nb\nc';
    ta.dispatchEvent(new Event('input'));
    await nextTick();
    expect(ta.style.height).toMatch(/px$/);
  });

  it('autosize follows runtime prop changes: on after mount, multiline swap, then off', async () => {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const m = await mount({ multiline: false, autosize: true });
    expect(control(m.host).tagName).toBe('INPUT');

    m.props.value = { multiline: true, autosize: true };
    await nextTick();
    await tick();
    const ta = control(m.host) as HTMLTextAreaElement;
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.style.height).toMatch(/px$/);
    expect(m.host.querySelector('.rozie-text-field')?.classList.contains('rozie-text-field--autosize')).toBe(true);

    m.props.value = { multiline: true, autosize: false };
    await nextTick();
    await tick();
    expect(ta.style.height).toBe('');
    expect(ta.style.overflowY).toBe('');
  });

  it('without autosize, never touches a height the user set', async () => {
    const m = await mount({ multiline: true });
    const ta = control(m.host) as HTMLTextAreaElement;
    ta.style.height = '123px';
    ta.value = 'x';
    ta.dispatchEvent(new Event('input'));
    m.model.value = 'y';
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    expect(ta.style.height).toBe('123px');
  });

  it('renders prefix and suffix only when filled', async () => {
    const bare = await mount();
    expect(bare.host.querySelector('.rozie-text-field-prefix')).toBeNull();
    const filled = await mount({}, { prefix: () => h('span', '$'), suffix: () => h('span', 'USD') });
    expect(filled.host.querySelector('.rozie-text-field-prefix')?.textContent).toBe('$');
    expect(filled.host.querySelector('.rozie-text-field-suffix')?.textContent).toBe('USD');
  });
});
