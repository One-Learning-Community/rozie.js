<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  items?: any[];
  title?: string;
  header?: Snippet<[{ remaining: any; total: any }]>;
  children?: Snippet<[{ item: any; toggle: any; remove: any }]>;
  empty?: Snippet;
  snippets?: Record<string, any>;
  onadd?: (...args: unknown[]) => void;
  ontoggle?: (...args: unknown[]) => void;
  onremove?: (...args: unknown[]) => void;
}

let {
  items = $bindable((() => [])()),
  title = 'Todo',
  header: __headerProp,
  children: __childrenProp,
  empty: __emptyProp,
  snippets,
  onadd,
  ontoggle,
  onremove,
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const children = $derived(__childrenProp ?? snippets?.children);
const empty = $derived(__emptyProp ?? snippets?.empty);

let draft = $state('');

const add = () => {
  const text = draft.trim();
  if (!text) return;
  items = [...items, {
    id: crypto.randomUUID(),
    text,
    done: false
  }];
  draft = '';
  onadd?.(text);
};
const toggle = id => {
  items = items.map(i => i.id === id ? {
    ...i,
    done: !i.done
  } : i);
  ontoggle?.(id);
};

// Internal method renamed from `remove` to `removeItem` to avoid colliding
// with `HTMLElement.prototype.remove()` on the Lit target — Lit emits user
// methods as class fields and the resulting `remove(id)` signature is
// incompatible with the inherited `remove(): void`. Public API is unchanged:
// the slot param is still `:remove`, the emitted event is still `'remove'`.
// Internal method renamed from `remove` to `removeItem` to avoid colliding
// with `HTMLElement.prototype.remove()` on the Lit target — Lit emits user
// methods as class fields and the resulting `remove(id)` signature is
// incompatible with the inherited `remove(): void`. Public API is unchanged:
// the slot param is still `:remove`, the emitted event is still `'remove'`.
const removeItem = id => {
  items = items.filter(i => i.id !== id);
  onremove?.(id);
};

const remaining = $derived(items.filter(i => !i.done).length);
</script>


<div class="todo-list">
  <header>
    {#if header}{@render header({ remaining, total: items.length })}{:else}
      
      <h3>{title} ({remaining} remaining)</h3>
    {/if}
  </header>

  <form onsubmit={(e) => { e.preventDefault(); (add as (...a: any[]) => any)(e); }}>
    <input bind:value={draft} placeholder="What needs doing?" />
    <button type="submit" disabled={!draft.trim()}>Add</button>
  </form>

  {#if items.length > 0}<ul>
    {#each items as item (item.id)}<li class={{ done: item.done }}>
      
      {#if children}{@render children({ item, toggle: () => toggle(item.id), remove: () => removeItem(item.id) })}{:else}
        <label><input type="checkbox" checked={item.done} onchange={(e) => { toggle(item.id); }} /><span>{item.text}</span></label>
        <button aria-label="Remove" onclick={(e) => { removeItem(item.id); }}>×</button>
      {/if}
    </li>{/each}
  </ul>{:else}<p class="empty">
    {#if empty}{@render empty()}{:else}Nothing to do. ✨{/if}
  </p>{/if}</div>


<style>
.todo-list { font-family: system-ui, sans-serif; }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
li.done span { text-decoration: line-through; opacity: 0.5; }
.empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
</style>
