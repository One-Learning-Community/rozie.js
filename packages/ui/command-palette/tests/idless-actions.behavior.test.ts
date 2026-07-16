// @vitest-environment happy-dom
/**
 * idless-actions.behavior.test.ts — mount-and-drive behavioral proof for
 * finding 7 (highlightedItem() id-less collision + windowed-level null).
 *
 * Root cause under test (a): CommandPalette.rozie `commandValue(it)` falls back
 * to the item OBJECT when it carries no `id` — stamped through the
 * `:data-cp-value` attribute it stringifies to '[object Object]' for EVERY
 * id-less row, so they all collide and `highlightedItem()`'s value scan returns
 * the FIRST match regardless of which row is actually highlighted → the wrong
 * command's action menu opens (and the wrong `@action-select` payload fires).
 * The fix stamps a collision-free positional `data-cp-index` (the row's index
 * within filteredItems()) and resolves `filteredItems()[idx]`.
 *
 * Root cause under test (b): on a per-level-virtual level an ACTIVE row that is
 * scrolled out of the rendered window has no DOM node → the active-row query
 * misses → highlightedItem() returns null → firing the action key must be a
 * graceful no-op (no wrong menu, no throw). Full support for actions on a
 * windowed-out row needs a combobox `activeValue` exposure (a future combobox
 * verb — NOT added here); this locks the honest degradation.
 *
 * Mirrors groupcap-actions.behavior.test.ts: mounts the REAL committed emitted
 * packages/vue/src/CommandPalette.vue.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import CommandPalette from '../packages/vue/src/CommandPalette.vue';

const hosts: HTMLElement[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

function mountPalette(props: Record<string, unknown>) {
  const openRef = ref(true);
  const queryRef = ref('');
  const actionSelectPayloads: unknown[] = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const app = createApp({
    render: () =>
      h(CommandPalette, {
        open: openRef.value,
        'onUpdate:open': (v: boolean) => {
          openRef.value = v;
        },
        query: queryRef.value,
        'onUpdate:query': (v: string) => {
          queryRef.value = v;
        },
        idBase: 'idless-actions-test',
        onActionSelect: (payload: unknown) => actionSelectPayloads.push(payload),
        ...props,
      }),
  });
  app.mount(host);
  return { app, host, actionSelectPayloads };
}

async function openPopup(host: HTMLElement) {
  const input = host.querySelector('input[role="combobox"]') as HTMLInputElement;
  input.dispatchEvent(new Event('focus'));
  await nextTick();
  await Promise.resolve();
  return input;
}

/** The actionKey default is `$mod+k` — ⌘K on the DOM-event-matcher shape. */
function fireActionKey(target: Element) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }),
  );
}

function optionRowFor(host: HTMLElement, label: string): HTMLElement {
  const row = Array.from(host.querySelectorAll('[role="option"]')).find((el) =>
    el.textContent?.includes(label),
  ) as HTMLElement | undefined;
  if (!row) throw new Error(`no option row found for "${label}"`);
  return row;
}

describe('CommandPalette id-less rows × per-row actions (finding 7, RED-first)', () => {
  // Two id-less commands, each with a DISTINCT action. Under the old
  // value-keyed resolution both stamp '[object Object]' and collide.
  function idlessItems() {
    return [
      { label: 'First', actions: [{ id: 'a1', label: 'Action One' }] },
      { label: 'Second', actions: [{ id: 'a2', label: 'Action Two' }] },
    ];
  }

  it('(a) ⌘K on the SECOND id-less row opens the SECOND row\'s menu, never the first (collision)', async () => {
    const { app, host } = mountPalette({ items: idlessItems() });
    await openPopup(host);

    const secondRow = optionRowFor(host, 'Second');
    secondRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await nextTick();

    const frame = host.querySelector('[data-testid="command-palette-frame"]') as HTMLElement;
    fireActionKey(frame);
    await nextTick();

    const menu = host.querySelector('[data-command-palette-menu]');
    expect(menu).not.toBeNull();
    // RED against the pre-fix leaf: the '[object Object]' value collision made
    // highlightedItem() return the FIRST id-less item → menu labelled 'First'.
    expect(menu!.getAttribute('aria-label')).toBe('Second');
    const actionLabel = menu!.querySelector('.rozie-command-palette-actions-menu-item-label');
    expect(actionLabel?.textContent).toContain('Action Two');

    app.unmount();
  });

  it('(a) the FIRST id-less row still resolves to itself (no regression)', async () => {
    const { app, host } = mountPalette({ items: idlessItems() });
    await openPopup(host);

    const firstRow = optionRowFor(host, 'First');
    firstRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await nextTick();

    const frame = host.querySelector('[data-testid="command-palette-frame"]') as HTMLElement;
    fireActionKey(frame);
    await nextTick();

    const menu = host.querySelector('[data-command-palette-menu]');
    expect(menu).not.toBeNull();
    expect(menu!.getAttribute('aria-label')).toBe('First');

    app.unmount();
  });

  it('(b) windowed-out/no-active-row: firing the action key is a graceful no-op (no menu, no throw)', async () => {
    // A per-level-virtual level: with no layout in happy-dom the windowing
    // renders no measurable rows, so no active-row anchor is resolvable — the
    // exact null path a real windowed-out active row hits. Firing ⌘K must not
    // throw and must not open a (wrong) menu.
    const longItems = Array.from({ length: 200 }, (_v, i) => ({
      id: `cmd-${i}`,
      label: `Command ${i}`,
      actions: [{ id: `act-${i}`, label: `Action ${i}` }],
    }));
    const { app, host } = mountPalette({
      items: longItems,
      virtual: true,
      virtualMaxHeight: '120px',
    });
    await openPopup(host);

    const frame = host.querySelector('[data-testid="command-palette-frame"]') as HTMLElement;
    expect(() => fireActionKey(frame)).not.toThrow();
    await nextTick();

    expect(host.querySelector('[data-command-palette-menu]')).toBeNull();

    app.unmount();
  });
});
