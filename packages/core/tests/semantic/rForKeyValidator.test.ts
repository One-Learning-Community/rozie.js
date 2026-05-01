// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-02 fills these in.
//
// SEM-03 r-for :key hygiene: ROZ300 (missing :key), ROZ301 (key is loop
// variable), ROZ302 (key is non-primitive expression).
import { describe, it } from 'vitest';

describe('rForKeyValidator — Plan 02-02', () => {
  it.todo('TodoList.rozie passes lint with :key="item.id"');
  it.todo('Synthetic missing-key: <li r-for="item in items">…</li> emits ROZ300 with loc on opening tag');
  it.todo('Synthetic :key="index" with r-for="(item, index) in items": emits ROZ301');
  it.todo('Synthetic :key="item" (entire iterated value): emits ROZ301 (loop variable)');
  it.todo('Synthetic :key="someObj" (non-primitive expression): emits ROZ302');
  it.todo('does NOT warn on :key="item.id ?? idx" (author-provided fallback per Pitfall 6)');
});
