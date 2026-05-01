// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-02 fills these in.
//
// SEM-01 unknown-reference validator: emits ROZ100..ROZ106 when $props/
// $data/$refs/$slots references resolve to nothing in the BindingsTable,
// or when lifecycle hooks appear outside script Program top level, or when
// async $onMount returns a function, or when $props['foo'] computed access
// is used.
import { describe, it } from 'vitest';

describe('unknownRefValidator — Plan 02-02', () => {
  // Plan 02-02 replaces these todos with live assertions.
  it.todo('emits ROZ100 for $props.bogus when bogus not in <props>');
  it.todo('emits ROZ101 for $data.bogus when bogus not in <data>');
  it.todo('emits ROZ102 for $refs.bogus when no template ref="bogus"');
  it.todo('emits ROZ103 for $slots.bogus when no <slot name="bogus">');
  it.todo('emits ROZ104 for $onMount called inside another function (not Program top level)');
  it.todo('emits ROZ105 warning for $onMount(async () => …) — Promise return cannot be cleanup (D-19 edge case)');
  it.todo('emits ROZ106 for $props["foo"] computed access');
  it.todo('does NOT emit ROZ100 for $props.value in Counter.rozie (value IS declared)');
  it.todo('does NOT throw on any input — collected-not-thrown D-08');
});
