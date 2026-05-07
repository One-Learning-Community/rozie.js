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
