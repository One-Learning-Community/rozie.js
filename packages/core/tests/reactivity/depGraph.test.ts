// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-03 fills these in.
//
// REACT-06 ReactiveDepGraph: Babel scope-walk identifier tracking matching
// eslint-plugin-react-hooks/exhaustive-deps semantics. Per D-21,
// opaque-at-helper-boundary: helper-function calls are recorded as closure
// deps but the analyzer does NOT recurse into helper bodies.
import { describe, it } from 'vitest';

describe('ReactiveDepGraph — Plan 02-03', () => {
  it.todo('Dropdown.rozie listener when="$props.open && $props.closeOnOutsideClick" returns deps [{scope:props,path:[open]},{scope:props,path:[closeOnOutsideClick]}]');
  it.todo('Dropdown.rozie listener does NOT include $refs.triggerEl or $refs.panelEl in deps (refs are stable per ExhaustiveDeps)');
  it.todo('Counter.rozie computed isValid uses canIncrement → returns deps [{scope:props,path:[value]},{scope:props,path:[step]},{scope:props,path:[max]}] (path narrowed to root identifier per Pitfall 1)');
  it.todo('helperFn($data.x) inside expression body: closure dep on helperFn, NOT transitive read of $data.x (D-21 opaque-at-helper-boundary)');
  it.todo('Locally-shadowed identifier: let x = ...; reading x — NOT recorded as dep');
  it.todo('5 fixture snapshots written: fixtures/dep-graph/{Counter,SearchInput,Dropdown,TodoList,Modal}.snap');
});
