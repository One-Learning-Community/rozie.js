import { createSignal } from 'solid-js';
import Counter from '../../../../Counter.rozie';

/**
 * CounterPage — wraps Counter.rozie with parent-controlled state for
 * the counter / counter-controllable tests.
 *
 * Exposes BOTH controlled and uncontrolled modes via a toggle button.
 * When controlled, the parent passes `value` and `onValueChange`.
 * When uncontrolled, Counter manages its own state via createControllableSignal.
 *
 * Phase 06.3 — SC #1 Solid consumer surface.
 */
export default function CounterPage() {
  const [value, setValue] = createSignal<number>(0);
  const [isControlled, setIsControlled] = createSignal(false);

  return (
    <div>
      <h2>Counter</h2>
      {isControlled() ? (
        <Counter value={value()} onValueChange={setValue} />
      ) : (
        <Counter defaultValue={0} onValueChange={setValue} />
      )}
      <button
        data-testid="toggle-controlled"
        onClick={() => setIsControlled((c) => !c)}
      >
        Toggle controlled mode
      </button>
      <p>
        Mode: <span data-testid="mode-label">{isControlled() ? 'controlled' : 'uncontrolled'}</span>
      </p>
      <p>
        Parent-tracked value: <span data-testid="parent-value">{value()}</span>
      </p>
    </div>
  );
}
