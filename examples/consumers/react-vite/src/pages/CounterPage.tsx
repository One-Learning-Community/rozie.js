import { useState } from 'react';
import type { JSX } from 'react';
import Counter from '../Counter.rozie';
import SourceMapTrigger from '../SourceMapTrigger.rozie';

/**
 * CounterPage — wraps Counter.rozie with parent-controlled state for the
 * counter / counter-controllable / console-preserved / source-maps Playwright
 * e2e tests.
 *
 * The page exposes BOTH controlled and uncontrolled modes via a toggle button.
 * When `isControlled` is true, the parent passes `value` and `onValueChange`;
 * when false, the Counter is uncontrolled (defaultValue + onValueChange only)
 * and useControllableState owns the state internally.
 *
 * Toggling between modes after first render is the marquee REACT-T-03 test
 * (success criterion 3) — useControllableState should detect the change and
 * fire ROZ550 console.warn (parent-flip detection).
 */
export default function CounterPage(): JSX.Element {
  const [value, setValue] = useState<number>(0);
  const [isControlled, setIsControlled] = useState(false);

  return (
    <div>
      <h2>Counter</h2>
      {isControlled ? (
        <Counter value={value} onValueChange={setValue} />
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
        Mode: <span data-testid="mode-label">{isControlled ? 'controlled' : 'uncontrolled'}</span>
      </p>
      <p>
        Parent-tracked value: <span data-testid="parent-value">{value}</span>
      </p>
      <SourceMapTrigger />
    </div>
  );
}
