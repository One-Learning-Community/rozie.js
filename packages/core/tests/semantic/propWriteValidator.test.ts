// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-02 fills these in.
//
// SEM-02 / ROZ200 prop-write validator: writes to $props.foo where foo
// lacks `model: true` are static compile errors.
import { describe, it } from 'vitest';

describe('propWriteValidator — Plan 02-02', () => {
  it.todo('Counter.rozie: $props.value += $props.step succeeds (model: true)');
  it.todo('Counter.rozie with $props.step += 1 inserted: emits exactly one ROZ200 with code-frame and related="Prop declared here"');
  it.todo('detects AssignmentExpression with operator "=" / "+=" / "-=" / "*=" / "??=" — operator-agnostic check (Pitfall 3)');
  it.todo('detects UpdateExpression "++" and "--" on $props.foo');
  it.todo('does NOT flag destructured rebind: const { value } = $props; value = 5');
});
