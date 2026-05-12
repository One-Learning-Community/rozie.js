<script setup>
import { ref } from 'vue';
import TodoList from '../../examples/TodoList.rozie';

const items = ref([
  { id: '1', text: 'Try the live demo', done: true },
  { id: '2', text: 'Add another item below', done: false },
  { id: '3', text: 'Toggle some checkboxes', done: false },
]);
</script>

# TodoList

Demonstrates `r-for` with required `:key`, two-way bound `items` array via `model: true`, multiple `$emit` calls for `add`/`toggle`/`remove`, named slot with fallback content (`#header` falls back to a default heading), default slot with per-item scoped params (the marquee scoped-slot pattern — consumer can override the row renderer), and `r-if` / `r-else` for the empty-state branch.

This is the heaviest scoped-slots example. The React output shows the documented divergence: instead of children-as-JSX, React consumers see a render-prop callback (`children?: (ctx) => ReactNode`, `renderHeader?: (ctx) => ReactNode`). The other four targets keep an idiomatic markup form.

## Live demo

Two-way bound to the page's `items` ref. Add, toggle, remove — every mutation flows back through `v-model:items` to the parent state. Delete every item and the empty-state slot's fallback kicks in.

<div class="rozie-demo">
  <ClientOnly>
    <TodoList v-model:items="items" title="Demo todos" />
  </ClientOnly>

  <p>Items on the page-level ref: <strong>{{ items.length }}</strong> ({{ items.filter(i => !i.done).length }} remaining)</p>
</div>

## Source — TodoList.rozie

```rozie
<rozie name="TodoList">

<props>
{
  items: { type: Array, default: () => [], model: true },
  title: { type: String, default: 'Todo' },
}
</props>

<data>
{
  draft: '',
}
</data>

<script>
const remaining = $computed(() => $props.items.filter(i => !i.done).length)

const add = () => {
  const text = $data.draft.trim()
  if (!text) return
  $props.items = [...$props.items, { id: crypto.randomUUID(), text, done: false }]
  $data.draft = ''
  $emit('add', text)
}

const toggle = (id) => {
  $props.items = $props.items.map(i =>
    i.id === id ? { ...i, done: !i.done } : i
  )
  $emit('toggle', id)
}

const remove = (id) => {
  $props.items = $props.items.filter(i => i.id !== id)
  $emit('remove', id)
}
</script>

<template>
<div class="todo-list">
  <header>
    <slot name="header" :remaining="remaining" :total="$props.items.length">
      <!-- Fallback content if consumer doesn't provide #header -->
      <h3>{{ $props.title }} ({{ remaining }} remaining)</h3>
    </slot>
  </header>

  <form @submit.prevent="add">
    <input r-model="$data.draft" placeholder="What needs doing?" />
    <button type="submit" :disabled="!$data.draft.trim()">Add</button>
  </form>

  <ul r-if="$props.items.length > 0">
    <li r-for="item in $props.items" :key="item.id" :class="{ done: item.done }">
      <!--
        Default slot with per-item params. Consumer can provide a custom row
        renderer via `#default="{ item, toggle, remove }"`, or omit it entirely
        to get the fallback row below.
      -->
      <slot :item="item" :toggle="() => toggle(item.id)" :remove="() => remove(item.id)">
        <label>
          <input type="checkbox" :checked="item.done" @change="toggle(item.id)" />
          <span>{{ item.text }}</span>
        </label>
        <button @click="remove(item.id)" aria-label="Remove">×</button>
      </slot>
    </li>
  </ul>

  <p r-else class="empty">
    <slot name="empty">Nothing to do. ✨</slot>
  </p>
</div>
</template>

<style>
.todo-list { font-family: system-ui, sans-serif; }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
li.done span { text-decoration: line-through; opacity: 0.5; }
.empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
</style>

</rozie>
```

## Vue output

```vue
<template>

<div class="todo-list">
  <header>
    <slot name="header" :remaining="remaining" :total="items.length">
      
      <h3>{{ props.title }} ({{ remaining }} remaining)</h3>
    </slot>
  </header>

  <form @submit.prevent="add">
    <input v-model="draft" placeholder="What needs doing?" />
    <button type="submit" :disabled="!draft.trim()">Add</button>
  </form>

  <ul v-if="items.length > 0">
    <li v-for="item in items" :key="item.id" :class="{ done: item.done }">
      
      <slot :item="item" :toggle="() => toggle(item.id)" :remove="() => remove(item.id)">
        <label>
          <input type="checkbox" :checked="item.done" @change="toggle(item.id)" />
          <span>{{ item.text }}</span>
        </label>
        <button aria-label="Remove" @click="remove(item.id)">×</button>
      </slot>
    </li>
  </ul><p v-else class="empty">
    <slot name="empty">Nothing to do. ✨</slot>
  </p></div>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{ title?: string }>(),
  { title: 'Todo' }
);

const items = defineModel<unknown[]>('items', { default: () => [] });

const emit = defineEmits<{
  add: [...args: any[]];
  toggle: [...args: any[]];
  remove: [...args: any[]];
}>();

defineSlots<{
  header(props: { remaining: any; total: any }): any;
  default(props: { item: any; toggle: any; remove: any }): any;
  empty(props: {  }): any;
}>();

const draft = ref('');

const remaining = computed(() => items.value.filter(i => !i.done).length);

const add = () => {
  const text = draft.value.trim();
  if (!text) return;
  items.value = [...items.value, {
    id: crypto.randomUUID(),
    text,
    done: false
  }];
  draft.value = '';
  emit('add', text);
};
const toggle = id => {
  items.value = items.value.map(i => i.id === id ? {
    ...i,
    done: !i.done
  } : i);
  emit('toggle', id);
};
const remove = id => {
  items.value = items.value.filter(i => i.id !== id);
  emit('remove', id);
};
</script>

<style scoped>
.todo-list { font-family: system-ui, sans-serif; }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
li.done span { text-decoration: line-through; opacity: 0.5; }
.empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
</style>
```

## React output

```tsx
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import styles from './TodoList.module.css';

interface HeaderCtx { remaining: any; total: any; }

interface ChildrenCtx { item: any; toggle: any; remove: any; }

interface TodoListProps {
  items?: unknown[];
  defaultValue?: unknown[];
  onItemsChange?: (items: unknown[]) => void;
  title?: string;
  onAdd?: (...args: unknown[]) => void;
  onToggle?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  children?: (ctx: ChildrenCtx) => ReactNode;
  renderEmpty?: ReactNode;
}

export default function TodoList(_props: TodoListProps): JSX.Element {
  const props: TodoListProps = {
    ..._props,
    title: _props.title ?? 'Todo',
  };
  const [items, setItems] = useControllableState({
    value: props.items,
    defaultValue: props.defaultValue ?? (() => [])(),
    onValueChange: props.onItemsChange,
  });
  const [draft, setDraft] = useState('');
  const remaining = useMemo(() => items.filter(i => !i.done).length, [items]);

  const { onAdd: _rozieProp_onAdd } = props;
    const add = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setItems([...items, {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    setDraft('');
    _rozieProp_onAdd && _rozieProp_onAdd(text);
  }, [_rozieProp_onAdd, draft, items, setItems]);
  const { onToggle: _rozieProp_onToggle } = props;
    const toggle = useCallback(id => {
    setItems(items.map(i => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    _rozieProp_onToggle && _rozieProp_onToggle(id);
  }, [_rozieProp_onToggle, items, setItems]);
  const { onRemove: _rozieProp_onRemove } = props;
    const remove = useCallback(id => {
    setItems(items.filter(i => i.id !== id));
    _rozieProp_onRemove && _rozieProp_onRemove(id);
  }, [_rozieProp_onRemove, items, setItems]);

  return (
    <>
    <div className={styles["todo-list"]}>
      <header>
        {props.renderHeader ? props.renderHeader({ remaining, total: items.length }) : <h3>{props.title} ({remaining} remaining)</h3>}
      </header>

      <form onSubmit={(e) => { e.preventDefault(); add(e); }}>
        <input placeholder="What needs doing?" value={draft} onChange={e => setDraft(e.target.value)} />
        <button type="submit" disabled={!draft.trim()}>Add</button>
      </form>

      {(items.length > 0) ? <ul>
        {items.map((item) => <li key={item.id} className={clsx({ [styles.done]: item.done })}>
          
          {props.children ? props.children({ item, toggle: () => toggle(item.id), remove: () => remove(item.id) }) : <><label>
              <input type="checkbox" checked={item.done} onChange={(e) => { toggle(item.id); }} />
              <span>{item.text}</span>
            </label><button aria-label="Remove" onClick={(e) => { remove(item.id); }}>×</button></>}
        </li>)}
      </ul> : <p className={styles.empty}>
        {props.renderEmpty ?? "Nothing to do. ✨"}
      </p>}</div>
    </>
  );
}
```

## Svelte output

```svelte
<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  items?: unknown[];
  title?: string;
  header?: Snippet<[any, any]>;
  children?: Snippet<[any, any, any]>;
  empty?: Snippet;
  onadd?: (...args: unknown[]) => void;
  ontoggle?: (...args: unknown[]) => void;
  onremove?: (...args: unknown[]) => void;
}

let {
  items = $bindable(() => []),
  title = 'Todo',
  header,
  children,
  empty,
  onadd,
  ontoggle,
  onremove,
}: Props = $props();

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
const remove = id => {
  items = items.filter(i => i.id !== id);
  onremove?.(id);
};

const remaining = $derived(items.filter(i => !i.done).length);
</script>


<div class="todo-list">
  <header>
    {#if header}{@render header(remaining, items.length)}{:else}
      
      <h3>{title} ({remaining} remaining)</h3>
    {/if}
  </header>

  <form onsubmit={(e) => { e.preventDefault(); add(e); }}>
    <input bind:value={draft} placeholder="What needs doing?" />
    <button type="submit" disabled={!draft.trim()}>Add</button>
  </form>

  {#if items.length > 0}<ul>
    {#each items as item (item.id)}<li class={{ done: item.done }}>
      
      {#if children}{@render children(item, () => toggle(item.id), () => remove(item.id))}{:else}
        <label>
          <input type="checkbox" checked={item.done} onchange={(e) => { toggle(item.id); }} />
          <span>{item.text}</span>
        </label>
        <button aria-label="Remove" onclick={(e) => { remove(item.id); }}>×</button>
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
```

## Angular output

```ts
import { Component, ContentChild, TemplateRef, ViewEncapsulation, computed, input, model, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface HeaderCtx {
  $implicit: { remaining: any; total: any };
  remaining: any;
  total: any;
}

interface DefaultCtx {
  $implicit: { item: any; toggle: any; remove: any };
  item: any;
  toggle: any;
  remove: any;
}

interface EmptyCtx {}

@Component({
  selector: 'rozie-todo-list',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule],
  template: `

    <div class="todo-list">
      <header>
        @if (headerTpl) {
    <ng-container *ngTemplateOutlet="headerTpl; context: { $implicit: { remaining: remaining(), total: items().length }, remaining: remaining(), total: items().length }" />
    } @else {

          
          <h3>{{ title() }} ({{ remaining() }} remaining)</h3>
        
    }
      </header>

      <form (submit)="_guarded_add($event)">
        <input [ngModel]="draft()" (ngModelChange)="draft.set($event)" [ngModelOptions]="{standalone: true}" placeholder="What needs doing?" />
        <button type="submit" [disabled]="!draft().trim()">Add</button>
      </form>

      @if (items().length > 0) {
    <ul>
        @for (item of items(); track item.id) {
    <li [class]="{ done: item.done }">
          
          @if (defaultTpl) {
    <ng-container *ngTemplateOutlet="defaultTpl; context: _defaultSlot_ctx_1(item)" />
    } @else {

            <label>
              <input type="checkbox" [checked]="item.done" (change)="_toggle(item.id)" />
              <span>{{ item.text }}</span>
            </label>
            <button aria-label="Remove" (click)="_remove(item.id)">×</button>
          
    }
        </li>
    }
      </ul>
    } @else {
    <p class="empty">
        @if (emptyTpl) {
    <ng-container *ngTemplateOutlet="emptyTpl" />
    } @else {
    Nothing to do. ✨
    }
      </p>
    }</div>

  `,
  styles: [`
    .todo-list { font-family: system-ui, sans-serif; }
    ul { list-style: none; padding: 0; }
    li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
    li.done span { text-decoration: line-through; opacity: 0.5; }
    .empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
    form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
  `],
})
export class TodoList {
  items = model<unknown[]>((() => [])());
  title = input<string>('Todo');
  draft = signal('');
  add = output<unknown>();
  toggle = output<unknown>();
  remove = output<unknown>();
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('empty', { read: TemplateRef }) emptyTpl?: TemplateRef<EmptyCtx>;

  remaining = computed(() => this.items().filter(i => !i.done).length);

  _add = () => {
    const text = this.draft().trim();
    if (!text) return;
    this.items.set([...this.items(), {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    this.draft.set('');
    this.add.emit(text);
  };
  _toggle = id => {
    this.items.set(this.items().map(i => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    this.toggle.emit(id);
  };
  _remove = id => {
    this.items.set(this.items().filter(i => i.id !== id));
    this.remove.emit(id);
  };

  static ngTemplateContextGuard(
    _dir: TodoList,
    _ctx: unknown,
  ): _ctx is HeaderCtx | DefaultCtx | EmptyCtx {
    return true;
  }

  private _guarded_add = (e: any) => {
    e.preventDefault();
    this._add(e);
  };

  private _defaultSlot_ctx_1 = (item: any) => ({ $implicit: { item: item, toggle: () => this._toggle(item.id), remove: () => this._remove(item.id) }, item: item, toggle: () => this._toggle(item.id), remove: () => this._remove(item.id) });
}

export default TodoList;
```

## Solid output

```tsx
import type { JSX } from 'solid-js';
import { For, Show, children, createMemo, createSignal, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';

interface HeaderSlotCtx { remaining: any; total: any; }

interface TodoListProps {
  items?: unknown[];
  defaultItems?: unknown[];
  onItemsChange?: (items: unknown[]) => void;
  title?: string;
  onAdd?: (...args: unknown[]) => void;
  onToggle?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  headerSlot?: (ctx: HeaderSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  emptySlot?: JSX.Element;
}

export default function TodoList(_props: TodoListProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['items', 'title', 'children']);
  const resolved = children(() => local.children);

  const [items, setItems] = createControllableSignal(_props as Record<string, unknown>, 'items', (() => [])());
  const [draft, setDraft] = createSignal('');
  const remaining = createMemo(() => items().filter(i => !i.done).length);

  const add = () => {
    const text = draft().trim();
    if (!text) return;
    setItems([...items(), {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    setDraft('');
    _props.onAdd?.(text);
  };
  const toggle = id => {
    setItems(items().map(i => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    _props.onToggle?.(id);
  };
  const remove = id => {
    setItems(items().filter(i => i.id !== id));
    _props.onRemove?.(id);
  };

  return (
    <>
    <style>{`.todo-list { font-family: system-ui, sans-serif; }
    ul { list-style: none; padding: 0; }
    li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
    li.done span { text-decoration: line-through; opacity: 0.5; }
    .empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
    form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }`}</style>
    <>
    <div class={"todo-list"}>
      <header>
        {_props.headerSlot ? _props.headerSlot({ remaining: remaining(), total: items().length }) : <h3>{local.title} ({remaining()} remaining)</h3>}
      </header>

      <form onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input placeholder="What needs doing?" value={draft()} onInput={e => setDraft(e.currentTarget.value)} />
        <button type="submit" disabled={!draft().trim()}>Add</button>
      </form>

      {<Show when={items().length > 0} fallback={<p class={"empty"}>
        {_props.emptySlot ?? "Nothing to do. ✨"}
      </p>}><ul>
        <For each={items()}>{(item) => <li classList={{ done: item.done }}>
          
          {resolved() ?? <><label>
              <input type="checkbox" checked={item.done} onChange={(e) => { toggle(item.id); }} />
              <span>{item.text}</span>
            </label><button aria-label="Remove" onClick={(e) => { remove(item.id); }}>×</button></>}
        </li>}</For>
      </ul></Show>}</div>
    </>
    </>
  );
}
```
