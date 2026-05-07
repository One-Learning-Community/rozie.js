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
