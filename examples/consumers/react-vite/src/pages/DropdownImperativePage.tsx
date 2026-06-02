import { useRef } from 'react';
import type { JSX } from 'react';
import Dropdown, { type DropdownHandle } from '../Dropdown.rozie';

/**
 * DropdownImperativePage — demonstrates the Phase 21 `$expose` imperative
 * handle from a NATIVE React consumer. Dropdown.rozie declares
 * `$expose({ toggle, close })`, so its compiled React output is a `forwardRef`
 * component whose ref carries `{ toggle, close }` (typed `DropdownHandle` in the
 * emitted `.d.ts`). This page holds that ref and drives the dropdown from
 * OUTSIDE buttons — without the parent owning the `open` model state — the
 * canonical "control a child imperatively" pattern.
 *
 * Anchor for the dropdown-imperative Playwright e2e: clicking the external
 * "Toggle via handle" button opens/closes the panel; "Close via handle" forces
 * it shut. (Consumer-side handle acquisition uses React's native `useRef` — the
 * `$expose` contract is producer-side only; there is no .rozie-level grammar
 * for a consumer to call a child's handle.)
 *
 * Phase 22 (REQ-2): the `DropdownHandle` interface is now imported BY NAME from
 * the per-module `Dropdown.d.rozie.ts` sidecar — `import Dropdown, { type
 * DropdownHandle } from '../Dropdown.rozie'` — so the compiled `$expose` handle
 * type drives the consumer's `useRef<DropdownHandle>`. The local re-declaration
 * + `as ForwardRefExoticComponent<...>` cast was deleted; the sidecar already
 * types `Dropdown` as a `ForwardRefExoticComponent<DropdownProps &
 * RefAttributes<DropdownHandle>>`, so `<Dropdown ref={handleRef} />` typechecks
 * directly.
 */

export default function DropdownImperativePage(): JSX.Element {
  const handleRef = useRef<DropdownHandle>(null);

  return (
    <div>
      <h2>Dropdown — imperative handle ($expose)</h2>
      <p>
        These buttons drive the dropdown through its <code>$expose</code> handle
        (<code>ref.current.toggle()</code> / <code>.close()</code>) — the parent
        never owns the <code>open</code> state.
      </p>
      <button
        data-testid="handle-toggle"
        onClick={() => handleRef.current?.toggle()}
      >
        Toggle via handle
      </button>
      <button
        data-testid="handle-close"
        onClick={() => handleRef.current?.close()}
      >
        Close via handle
      </button>

      <Dropdown
        ref={handleRef}
        closeOnOutsideClick={true}
        closeOnEscape={true}
        renderTrigger={() => (
          <button data-testid="imp-trigger">Trigger (or use the buttons above)</button>
        )}
      >
        {() => (
          <ul data-testid="imp-items" style={{ margin: 0, padding: '0.5rem 1rem' }}>
            <li>Item A</li>
            <li>Item B</li>
            <li>Item C</li>
          </ul>
        )}
      </Dropdown>
    </div>
  );
}
