import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx, useDebouncedCallback } from '@rozie/runtime-react';
import './SearchInput.css';

interface SearchInputProps {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onSearch?: (...args: any[]) => void;
  onClear?: (...args: any[]) => void;
}

export default function SearchInput(_props: SearchInputProps): JSX.Element {
  const props: Omit<SearchInputProps, 'placeholder' | 'minLength' | 'autofocus'> & { placeholder: string; minLength: number; autofocus: boolean } = {
    ..._props,
    placeholder: _props.placeholder ?? 'Search…',
    minLength: _props.minLength ?? 2,
    autofocus: _props.autofocus ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { placeholder, minLength, autofocus, onSearch, onClear, ...rest } = _props as SearchInputProps & Record<string, unknown>;
    void placeholder; void minLength; void autofocus; void onSearch; void onClear;
    return rest;
  })();
  const _autofocusRef = useRef(props.autofocus);
  _autofocusRef.current = props.autofocus;
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
    if (_autofocusRef.current) inputEl.current?.focus();

    // Returning a function from $onMount registers a teardown — equivalent to
    // a separate $onUnmount, useful when setup and teardown logic belong together.
    return () => {
      // e.g., abort an in-flight request initialized in this hook
    };
  }, []);

  const _rozieDebouncedOnSearch = useDebouncedCallback(onSearch, [onSearch], 300);

  return (
    <>
    <div {...attrs} className={clsx("search-input", (attrs.className as string | undefined))} data-rozie-s-8bbc4a60="">
      
      <input ref={inputEl} type="search" placeholder={props.placeholder} value={query} onChange={e => setQuery(e.target.value)} onInput={_rozieDebouncedOnSearch} onKeyDown={($event) => { (($event) => { if ($event.key !== 'Enter') return; ((onSearch) as ((...args: any[]) => any))($event); })($event); (($event) => { if ($event.key !== 'Escape') return; ((clear) as ((...args: any[]) => any))($event); })($event); }} data-rozie-s-8bbc4a60="" />

      {(query.length > 0) ? <button className={"clear-btn"} aria-label="Clear" onClick={clear} data-rozie-s-8bbc4a60="">
        ×
      </button> : <span className={"hint"} data-rozie-s-8bbc4a60="">{props.minLength}+ chars</span>}</div>
    </>
  );
}
