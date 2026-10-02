// @vitest-environment happy-dom
/**
 * oinbox-feedback.behavior.test.ts — mount-and-drive proof for the 0.8.0 oinbox
 * follow-ups (quick 261002-ekf), against the committed packages/vue/src/Combobox.vue
 * leaf (the token-input.behavior.test.ts precedent). The use case is a Gmail-style
 * recipient field: `multiple` + `disableFilter` + `delimiters` + `validate`.
 *
 *   F1  a delimited paste inserts the rejected remainder at the caret (replacing the
 *       selection) instead of replacing the whole input; `splitPaste` hook.
 *   F3  `validate` may return the string to store (normalise), Tags-style.
 *   F4  `search` fires with `{ query: '' }` whenever Combobox clears the query
 *       itself; `query()` on the handle.
 *   F5  `commitOnBlur`.
 *   F6  a unique default `idBase` per instance.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import Combobox from '../packages/vue/src/Combobox.vue';

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const isEmail = (t: string) => EMAIL.test(t);
// Normalising validator: `Name <addr>` → `addr`; a bare address passes through.
const toAddress = (t: string) => {
  const m = /<([^<>]+)>\s*$/.exec(t);
  const addr = (m ? m[1] : t).trim();
  return EMAIL.test(addr) ? addr.toLowerCase() : false;
};

interface Handle {
  query: () => string;
  clear: () => void;
}

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

function mount(props: Record<string, unknown> = {}) {
  const value = ref<unknown>(props.value ?? []);
  const changes: Array<Record<string, unknown>> = [];
  const searches: string[] = [];
  const handleRef = ref<Handle | null>(null);
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const { value: _ignored, ...rest } = props;
  createApp({
    render: () =>
      h(Combobox, {
        ref: handleRef,
        value: value.value,
        'onUpdate:value': (v: unknown) => {
          value.value = v;
        },
        onChange: (e: Record<string, unknown>) => changes.push(e),
        onSearch: (e: { query: string }) => searches.push(e.query),
        multiple: true,
        disableFilter: true,
        delimiters: [',', ';'],
        validate: isEmail,
        options: [],
        ariaLabel: 'To',
        ...rest,
      }),
  }).mount(host);
  const input = host.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { host, input, changes, searches, value: () => value.value, handle: () => handleRef.value as Handle };
}

async function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.setSelectionRange(text.length, text.length);
  input.dispatchEvent(new Event('input'));
  await nextTick();
}

async function key(input: HTMLInputElement, k: string) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  input.dispatchEvent(ev);
  await nextTick();
  return ev;
}

async function paste(input: HTMLInputElement, text: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
  input.dispatchEvent(ev);
  await nextTick();
  return ev.defaultPrevented;
}

describe('F1 — a delimited paste keeps the text already in the input', () => {
  it('inserts the rejected remainder at the caret (oinbox repro)', async () => {
    const m = mount();
    await type(m.input, 'ann@');
    const prevented = await paste(m.input, 'corp.com, bob@x.test');
    expect(prevented).toBe(true);
    expect(m.value()).toEqual(['bob@x.test']);
    expect(m.input.value).toBe('ann@corp.com');
    expect(m.handle().query()).toBe('ann@corp.com');
    // The caret sits after the inserted text, as an ordinary paste leaves it.
    expect(m.input.selectionStart).toBe('ann@corp.com'.length);
    // The query changed without an input event: hosts tracking it hear about it.
    expect(m.searches[m.searches.length - 1]).toBe('ann@corp.com');
  });

  it('replaces the selection, keeping the text on both sides', async () => {
    const m = mount();
    await type(m.input, 'xx yy');
    m.input.setSelectionRange(0, 2);
    await paste(m.input, 'zz; cat@x.test');
    expect(m.value()).toEqual(['cat@x.test']);
    expect(m.input.value).toBe('zz yy');
  });

  it('every part accepted: the typed text is left alone', async () => {
    const m = mount();
    await type(m.input, 'dan');
    await paste(m.input, 'a@x.test, b@x.test');
    expect(m.value()).toEqual(['a@x.test', 'b@x.test']);
    expect(m.input.value).toBe('dan');
  });
});

describe('F1 — splitPaste hook', () => {
  it('replaces the built-in split (quote-aware host splitter)', async () => {
    const splitPaste = (t: string) => t.match(/"[^"]*"\s*<[^>]*>|[^,;]+/g)?.map((p) => p.trim()) ?? null;
    const m = mount({ splitPaste, validate: toAddress });
    const prevented = await paste(m.input, '"Roe, Sam" <sam@x.test>, bob@x.test');
    expect(prevented).toBe(true);
    expect(m.value()).toEqual(['sam@x.test', 'bob@x.test']);
  });

  it('null means "not mine": the paste is left to the browser, nothing commits', async () => {
    const m = mount({ splitPaste: () => null });
    const prevented = await paste(m.input, 'a@x.test, b@x.test');
    expect(prevented).toBe(false);
    expect(m.value()).toEqual([]);
  });

  it('is consulted even when the text has no built-in delimiter', async () => {
    const m = mount({ splitPaste: (t: string) => t.split(/\s+/) });
    const prevented = await paste(m.input, 'a@x.test b@x.test');
    expect(prevented).toBe(true);
    expect(m.value()).toEqual(['a@x.test', 'b@x.test']);
  });
});

describe('F3 — validate may return the string to store', () => {
  it('stores the normalised string on Enter, delimiter and paste; change.text is the stored value', async () => {
    const m = mount({ validate: toAddress });
    await type(m.input, 'Sam Roe <Sam@X.test>');
    await key(m.input, 'Enter');
    expect(m.value()).toEqual(['sam@x.test']);
    expect(m.changes[0].text).toBe('sam@x.test');
    await type(m.input, 'Bob <bob@x.test>');
    await key(m.input, ',');
    await paste(m.input, 'Cat <cat@x.test>; nope');
    expect(m.value()).toEqual(['sam@x.test', 'bob@x.test', 'cat@x.test']);
    expect(m.input.value).toBe('nope');
  });

  it("'' / null / false reject; true keeps the trimmed text (boolean validators unchanged)", async () => {
    const empty = mount({ validate: () => '' });
    await type(empty.input, 'x@y.z');
    await key(empty.input, 'Enter');
    expect(empty.value()).toEqual([]);
    expect(empty.input.value).toBe('x@y.z');
    const yes = mount({ validate: () => true });
    await type(yes.input, '  x@y.z  ');
    await key(yes.input, 'Enter');
    expect(yes.value()).toEqual(['x@y.z']);
  });

  it('dedups on the normalised value', async () => {
    const m = mount({ validate: toAddress, value: ['sam@x.test'] });
    await type(m.input, 'Sam <SAM@x.test>');
    await key(m.input, 'Enter');
    expect(m.value()).toEqual(['sam@x.test']);
    expect(m.changes).toHaveLength(0);
    expect(m.input.value).toBe('');
  });
});

describe('F4 — search fires when Combobox clears the query itself; query() handle', () => {
  it('a duplicate free-text commit clears the input and fires search ""', async () => {
    const m = mount({ value: ['ann@x.test'] });
    await type(m.input, 'ann@x.test');
    expect(m.searches).toEqual(['ann@x.test']);
    await key(m.input, 'Enter');
    expect(m.changes).toHaveLength(0);
    expect(m.input.value).toBe('');
    expect(m.searches).toEqual(['ann@x.test', '']);
    expect(m.handle().query()).toBe('');
  });

  it('a free-text commit and a delimiter commit fire search ""', async () => {
    const m = mount();
    await type(m.input, 'a@x.test');
    await key(m.input, 'Enter');
    await type(m.input, 'b@x.test');
    await key(m.input, ';');
    expect(m.searches).toEqual(['a@x.test', '', 'b@x.test', '']);
  });

  it('a pick under multiple fires search ""', async () => {
    const m = mount({ options: [{ value: 'ann@x.test', label: 'Ann' }], validate: null, delimiters: [] });
    await type(m.input, 'An');
    await key(m.input, 'Enter');
    expect(m.value()).toEqual(['ann@x.test']);
    expect(m.searches).toEqual(['An', '']);
  });

  it('clear() fires search "" when there was text; never when already empty', async () => {
    const m = mount();
    m.handle().clear();
    await nextTick();
    expect(m.searches).toEqual([]);
    await type(m.input, 'zz');
    m.handle().clear();
    await nextTick();
    expect(m.searches).toEqual(['zz', '']);
    expect(m.handle().query()).toBe('');
  });

  it('query() reflects typed text', async () => {
    const m = mount();
    expect(m.handle().query()).toBe('');
    await type(m.input, 'ann');
    expect(m.handle().query()).toBe('ann');
  });
});

describe('F5 — commitOnBlur', () => {
  it('commits valid typed text on blur (through validate)', async () => {
    const m = mount({ commitOnBlur: true, validate: toAddress });
    await type(m.input, 'Sam <sam@x.test>');
    m.input.dispatchEvent(new FocusEvent('blur'));
    await nextTick();
    expect(m.value()).toEqual(['sam@x.test']);
    expect(m.input.value).toBe('');
    expect(m.searches[m.searches.length - 1]).toBe('');
  });

  it('leaves rejected text in place on blur', async () => {
    const m = mount({ commitOnBlur: true });
    await type(m.input, 'not-an-address');
    m.input.dispatchEvent(new FocusEvent('blur'));
    await nextTick();
    expect(m.value()).toEqual([]);
    expect(m.input.value).toBe('not-an-address');
  });

  it('is off by default', async () => {
    const m = mount();
    await type(m.input, 'a@x.test');
    m.input.dispatchEvent(new FocusEvent('blur'));
    await nextTick();
    expect(m.value()).toEqual([]);
  });
});

describe('F6 — unique default idBase', () => {
  it('two default-configured instances do not share listbox / popover ids', async () => {
    const opts = { options: [{ value: 'a', label: 'Alpha' }], validate: null, delimiters: [] };
    const a = mount(opts);
    const b = mount(opts);
    await nextTick();
    const ca = a.input.getAttribute('aria-controls');
    const cb = b.input.getAttribute('aria-controls');
    expect(ca).toBeTruthy();
    expect(ca).not.toBe(cb);
    await type(a.input, 'Al');
    await type(b.input, 'Al');
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('an explicit idBase is honoured', async () => {
    const m = mount({ idBase: 'to-field' });
    expect(m.input.getAttribute('aria-controls')).toBe('to-field-list');
  });
});
