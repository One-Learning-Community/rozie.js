# SearchInput

Demonstrates `r-model` on a form input, `$emit` for custom events, `$onMount` with a teardown return, the parameterized `.debounce(300)` modifier, conditional rendering (`r-if` / `r-else`), and `$refs`.

## Source — SearchInput.rozie

```rozie
<rozie name="SearchInput">

<props>
{
  placeholder: { type: String,  default: 'Search…' },
  minLength:   { type: Number,  default: 2 },
  autofocus:   { type: Boolean, default: false },
}
</props>

<data>
{
  query: '',
}
</data>

<script>
const isValid = $computed(() => $data.query.length >= $props.minLength)

const onSearch = () => {
  if (isValid) $emit('search', $data.query)
}

const clear = () => {
  $data.query = ''
  $emit('clear')
}

$onMount(() => {
  if ($props.autofocus) $refs.inputEl?.focus()

  // Returning a function from $onMount registers a teardown — equivalent to
  // a separate $onUnmount, useful when setup and teardown logic belong together.
  return () => {
    // e.g., abort an in-flight request initialized in this hook
  }
})
</script>

<template>
<div class="search-input">
  <!--
    Modifier on a template event, same grammar as the <listeners> block:
    - .debounce(300) waits 300ms after the last keystroke before firing
    - .enter triggers immediately on Enter even if the debounce window hasn't elapsed
  -->
  <input
    ref="inputEl"
    type="search"
    :placeholder="$props.placeholder"
    r-model="$data.query"
    @input.debounce(300)="onSearch"
    @keydown.enter="onSearch"
    @keydown.escape="clear"
  />

  <button r-if="$data.query.length > 0" class="clear-btn" @click="clear" aria-label="Clear">
    ×
  </button>
  <span r-else class="hint">{{ $props.minLength }}+ chars</span>
</div>
</template>

<style>
.search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
input { padding: 0.25rem 0.5rem; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
</style>

</rozie>
```

## Vue output

```vue
<template>

<div class="search-input">
  
  <input ref="inputElRef" type="search" :placeholder="props.placeholder" v-model="query" @input="debouncedOnSearch" @keydown.enter="onSearch" @keydown.esc="clear" />

  <button v-if="query.length > 0" class="clear-btn" aria-label="Clear" @click="clear">
    ×
  </button><span v-else class="hint">{{ props.minLength }}+ chars</span></div>

</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { debounce } from '@rozie/runtime-vue';

const props = withDefaults(
  defineProps<{ placeholder?: string; minLength?: number; autofocus?: boolean }>(),
  { placeholder: 'Search…', minLength: 2, autofocus: false }
);

const emit = defineEmits<{
  search: [...args: any[]];
  clear: [...args: any[]];
}>();

const query = ref('');

const inputElRef = ref<HTMLInputElement>();

const isValid = computed(() => query.value.length >= props.minLength);

const onSearch = () => {
  if (isValid.value) emit('search', query.value);
};
const clear = () => {
  query.value = '';
  emit('clear');
};

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  if (props.autofocus) inputElRef.value?.focus();

  // Returning a function from $onMount registers a teardown — equivalent to
  // a separate $onUnmount, useful when setup and teardown logic belong together.
  _cleanup_0 = () => {
    // e.g., abort an in-flight request initialized in this hook
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

const debouncedOnSearch = debounce(onSearch, 300);
</script>

<style scoped>
.search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
input { padding: 0.25rem 0.5rem; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
</style>
```

## React output

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from '@rozie/runtime-react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onSearch?: (...args: unknown[]) => void;
  onClear?: (...args: unknown[]) => void;
}

export default function SearchInput(_props: SearchInputProps): JSX.Element {
  const props: SearchInputProps = {
    ..._props,
    placeholder: _props.placeholder ?? 'Search…',
    minLength: _props.minLength ?? 2,
    autofocus: _props.autofocus ?? false,
  };
  const [query, setQuery] = useState('');
  const inputEl = useRef<HTMLInputElement | null>(null);
  const isValid = useMemo(() => query.length >= props.minLength, [props.minLength, query]);

  const { onSearch: _rozieProp_onSearch } = props;
    const onSearch = useCallback(() => {
    if (isValid) _rozieProp_onSearch && _rozieProp_onSearch(query);
  }, [_rozieProp_onSearch, isValid, query]);
  const { onClear: _rozieProp_onClear } = props;
    const clear = useCallback(() => {
    setQuery('');
    _rozieProp_onClear && _rozieProp_onClear();
  }, [_rozieProp_onClear]);

  useEffect(() => {
    if (props.autofocus) inputEl.current?.focus();

  // Returning a function from $onMount registers a teardown — equivalent to
  // a separate $onUnmount, useful when setup and teardown logic belong together.
    return () => {
      
    };
  }, [props.autofocus]);

  const _rozieDebouncedOnSearch = useDebouncedCallback(onSearch, [onSearch], 300);

  return (
    <>
    <div className={styles["search-input"]}>
      
      <input ref={inputEl} type="search" placeholder={props.placeholder} value={query} onChange={e => setQuery(e.target.value)} onInput={_rozieDebouncedOnSearch} onKeyDown={(e) => { ((e) => { if (e.key !== 'Enter') return; onSearch(e); })(e); ((e) => { if (e.key !== 'Escape') return; clear(e); })(e); }} />

      {(query.length > 0) ? <button className={styles["clear-btn"]} aria-label="Clear" onClick={clear}>
        ×
      </button> : <span className={styles.hint}>{props.minLength}+ chars</span>}</div>
    </>
  );
}
```

## Svelte output

```svelte
<script lang="ts">
interface Props {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onsearch?: (...args: unknown[]) => void;
  onclear?: (...args: unknown[]) => void;
}

let {
  placeholder = 'Search…',
  minLength = 2,
  autofocus = false,
  onsearch,
  onclear,
}: Props = $props();

let query = $state('');

let inputEl = $state<HTMLInputElement | undefined>(undefined);

const onSearch = () => {
  if (isValid) onsearch?.(query);
};
const clear = () => {
  query = '';
  onclear?.();
};

const isValid = $derived(query.length >= minLength);

$effect(() => {
  if (autofocus) inputEl?.focus();

  // Returning a function from $onMount registers a teardown — equivalent to
  // a separate $onUnmount, useful when setup and teardown logic belong together.
  return () => {
    // e.g., abort an in-flight request initialized in this hook
  };
});

const debouncedOnSearch = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: any[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => (onSearch)(...args), 300);
  };
})();
</script>


<div class="search-input">
  
  <input bind:this={inputEl} type="search" placeholder={placeholder} bind:value={query} oninput={debouncedOnSearch} onkeydown={(e) => { (() => { if (e.key !== 'Enter') return; onSearch(e); })(); (() => { if (e.key !== 'Escape') return; clear(e); })(); }} />

  {#if query.length > 0}<button class="clear-btn" aria-label="Clear" onclick={clear}>
    ×
  </button>{:else}<span class="hint">{minLength}+ chars</span>{/if}</div>


<style>
.search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
input { padding: 0.25rem 0.5rem; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
</style>
```

## Angular output

```ts
import { Component, DestroyRef, ElementRef, ViewEncapsulation, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-search-input',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="search-input">
      
      <input #inputEl type="search" [placeholder]="placeholder()" [ngModel]="query()" (ngModelChange)="query.set($event)" [ngModelOptions]="{standalone: true}" (input)="debouncedOnSearch($event)" (keydown)="_merged_keydown_1($event)" />

      @if (query().length > 0) {
    <button class="clear-btn" aria-label="Clear" (click)="_clear($event)">
        ×
      </button>
    } @else {
    <span class="hint">{{ minLength() }}+ chars</span>
    }</div>

  `,
  styles: [`
    .search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
    input { padding: 0.25rem 0.5rem; }
    .clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
    .hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
  `],
})
export class SearchInput {
  placeholder = input<string>('Search…');
  minLength = input<number>(2);
  autofocus = input<boolean>(false);
  query = signal('');
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  search = output<unknown>();
  clear = output<unknown>();

  constructor() {
    if (this.autofocus()) this.inputEl()?.nativeElement?.focus();

    // Returning a function from $onMount registers a teardown — equivalent to
    // a separate $onUnmount, useful when setup and teardown logic belong together.
    inject(DestroyRef).onDestroy(() => {
      // e.g., abort an in-flight request initialized in this hook
    });
  }

  isValid = computed(() => this.query().length >= this.minLength());

  onSearch = () => {
    if (this.isValid()) this.search.emit(this.query());
  };
  _clear = () => {
    this.query.set('');
    this.clear.emit();
  };

  private debouncedOnSearch = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: any[]) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => (this.onSearch)(...args), 300);
    };
  })();

  private _guardedOnSearch_2 = (e: any) => {
    if (e.key !== 'Enter') return;
    this.onSearch(e);
  };

  private _guarded_clear_3 = (e: any) => {
    if (e.key !== 'Escape') return;
    this._clear(e);
  };

  private _merged_keydown_1 = (e: any) => {
    this._guardedOnSearch_2(e);
    this._guarded_clear_3(e);
  };
}

export default SearchInput;
```

## Solid output

```tsx
import type { JSX } from 'solid-js';
import { Show, createMemo, createSignal, onCleanup, onMount, splitProps } from 'solid-js';
import { createDebouncedHandler } from '@rozie/runtime-solid';

interface SearchInputProps {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onSearch?: (...args: unknown[]) => void;
  onClear?: (...args: unknown[]) => void;
}

export default function SearchInput(_props: SearchInputProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['placeholder', 'minLength', 'autofocus']);

  const [query, setQuery] = createSignal('');
  const isValid = createMemo(() => query().length >= local.minLength);
  onMount(() => {
    const _cleanup = (() => {
    if (local.autofocus) inputElRef?.focus();

    // Returning a function from $onMount registers a teardown — equivalent to
    // a separate $onUnmount, useful when setup and teardown logic belong together.
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    // e.g., abort an in-flight request initialized in this hook
  });
  });
  let inputElRef: HTMLElement | null = null;

  const onSearch = () => {
    if (isValid()) _props.onSearch?.(query());
  };
  const clear = () => {
    setQuery('');
    _props.onClear?.();
  };

  const _rozieDebouncedOnSearch = createDebouncedHandler(onSearch, 300);

  return (
    <>
    <style>{`.search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
    input { padding: 0.25rem 0.5rem; }
    .clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
    .hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }`}</style>
    <>
    <div class={"search-input"}>
      
      <input type="search" ref={(el) => { inputElRef = el as HTMLElement; }} placeholder={local.placeholder} value={query()} onInput={(e) => { (e => setQuery(e.currentTarget.value))(e); _rozieDebouncedOnSearch(e); }} onKeyDown={(e) => { ((e) => { if (e.key !== 'Enter') return; onSearch(); })(e); ((e) => { if (e.key !== 'Escape') return; clear(); })(e); }} />

      {<Show when={query().length > 0} fallback={<span class={"hint"}>{local.minLength}+ chars</span>}><button aria-label="Clear" class={"clear-btn"} onClick={clear}>
        ×
      </button></Show>}</div>
    </>
    </>
  );
}
```
