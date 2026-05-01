// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-05 fills these in.
//
// REACT-04 + REACT-05 + D-19: LifecycleHook IR pairs setup + cleanup.
// Plan 05 lowerScript reads BindingsTable.lifecycle entries (collected
// in Plan 02-01 Task 3) and runs extractCleanupReturn on each callback
// to produce paired IR nodes.
import { describe, it } from 'vitest';

describe('LifecycleHook IR — Plan 02-05 (D-19 pairing)', () => {
  it.todo('Modal.rozie produces LifecycleHook[] of length 2 (after D-19 pairing): pair 0 = { phase: mount, setup: lockScroll, cleanup: unlockScroll } (paired via $onUnmount(unlockScroll) immediately following), pair 1 = { phase: mount, setup: arrow body for focus, cleanup: undefined }');
  it.todo('SearchInput.rozie produces LifecycleHook[] of length 1 with cleanup extracted: { phase: mount, setup: BlockStatement without trailing return, cleanup: ArrowFunctionExpression for the returned teardown }');
  it.todo('Dropdown.rozie produces LifecycleHook[] of length 2 (both mount, no cleanup, source order preserved per REACT-04)');
  it.todo('Counter.rozie + TodoList.rozie produce LifecycleHook[] of length 0');
  it.todo('Synthetic $onMount(async () => { return cleanup }): emits ROZ105 warning, cleanup === undefined, isAsync === true (Pitfall 2)');
});
