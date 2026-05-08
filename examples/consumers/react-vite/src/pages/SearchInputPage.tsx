import { useState } from 'react';
import type { JSX } from 'react';
import SearchInput from '../SearchInput.rozie';

/**
 * SearchInputPage — wraps SearchInput.rozie with parent-controlled query
 * tracking for the @input.debounce(300) verification (Phase 4 carryover).
 */
export default function SearchInputPage(): JSX.Element {
  const [lastQuery, setLastQuery] = useState('');

  return (
    <div>
      <h2>SearchInput</h2>
      <SearchInput
        placeholder="Search…"
        minLength={2}
        autofocus={false}
        onSearch={(...args: unknown[]) => setLastQuery(String(args[0] ?? ''))}
        onClear={() => setLastQuery('')}
      />
      {lastQuery && <p data-testid="last-query">Last query: {lastQuery}</p>}
    </div>
  );
}
