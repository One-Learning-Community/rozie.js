// @vitest-environment happy-dom
/**
 * paste.behavior.test.ts — Tags paste keeps the typed draft (found during quick
 * 261002-ekf while fixing the same bug in Combobox, oinbox 0.8.0 feedback F1).
 *
 * Before: with the default delimiters (`[',', 'Enter']`) EVERY paste was
 * intercepted — even one with no separator — and a successful paste cleared the
 * draft, so `ann@` + paste `corp.com` committed a `corp.com` token and lost `ann@`;
 * parts `validate` rejected vanished. The early-return meant to "let the input
 * handle a plain paste" only fired with no delimiters at all.
 *
 * Mounts the committed packages/vue/src/Tags.vue leaf (the combobox
 * token-input.behavior.test.ts precedent).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Tags from '../packages/vue/src/Tags.vue';

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

function mount(props: Record<string, unknown> = {}) {
  const value = ref<string[]>([]);
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  createApp({
    render: () =>
      h(Tags, {
        modelValue: value.value,
        'onUpdate:modelValue': (v: string[]) => {
          value.value = v;
        },
        ariaLabel: 'Tags',
        ...props,
      }),
  }).mount(host);
  const input = host.querySelector('input') as HTMLInputElement;
  return { input, value: () => value.value };
}

async function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.setSelectionRange(text.length, text.length);
  input.dispatchEvent(new Event('input'));
  await nextTick();
}

async function paste(input: HTMLInputElement, text: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
  input.dispatchEvent(ev);
  await nextTick();
  return ev.defaultPrevented;
}

const isEmail = (t: string) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : false);

describe('Tags paste', () => {
  it('a paste with no separator is ordinary text (not intercepted, nothing committed)', async () => {
    const m = mount();
    await type(m.input, 'ann@');
    const prevented = await paste(m.input, 'corp.com');
    expect(prevented).toBe(false);
    expect(m.value()).toEqual([]);
  });

  it('a delimited paste keeps the typed draft and inserts the rejected parts at the caret', async () => {
    const m = mount({ validate: isEmail });
    await type(m.input, 'ann@');
    const prevented = await paste(m.input, 'corp.com, bob@x.test');
    expect(prevented).toBe(true);
    expect(m.value()).toEqual(['bob@x.test']);
    expect(m.input.value).toBe('ann@corp.com');
    expect(m.input.selectionStart).toBe('ann@corp.com'.length);
  });

  it('a delimited paste with every part accepted leaves the draft alone', async () => {
    const m = mount();
    await type(m.input, 'draft');
    await paste(m.input, 'a, b');
    expect(m.value()).toEqual(['a', 'b']);
    expect(m.input.value).toBe('draft');
  });

  it('a part that duplicates a committed tag is dropped, not put back in the input', async () => {
    const m = mount();
    await paste(m.input, 'a, b');
    await paste(m.input, 'b, c');
    expect(m.value()).toEqual(['a', 'b', 'c']);
    expect(m.input.value).toBe('');
  });
});
