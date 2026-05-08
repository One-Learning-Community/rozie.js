import { useState } from 'react';
import type { JSX } from 'react';
import Dropdown from '../Dropdown.rozie';

/**
 * DropdownPage — wraps Dropdown.rozie with parent-controlled `open` state for
 * the dropdown-outside-click + dropdown-stale-closure Playwright e2e tests.
 *
 * Provides a "Force open prop" toggle so the stale-closure spec can flip the
 * `open` prop between renders WITHOUT going through the Dropdown's internal
 * toggle. The .outside listener inside Dropdown should observe the LATEST
 * closure value (REACT-T-02 / Pitfall 1 — D-61 stale-closure defense).
 */
export default function DropdownPage(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);

  return (
    <div>
      <h2>Dropdown</h2>
      <Dropdown
        open={forceOpen ? true : open}
        onOpenChange={setOpen}
        closeOnOutsideClick={true}
        closeOnEscape={true}
        renderTrigger={() => (
          <button className="dropdown-trigger" data-testid="dropdown-trigger">
            Toggle Dropdown
          </button>
        )}
      >
        {() => (
          <ul className="dropdown-items" data-testid="dropdown-items">
            <li>Item A</li>
            <li>Item B</li>
            <li>Item C</li>
          </ul>
        )}
      </Dropdown>
      <p>
        Open: <span data-testid="dropdown-open-state">{String(open)}</span>
      </p>
      <button
        data-testid="force-open"
        onClick={() => setForceOpen((f) => !f)}
      >
        {forceOpen ? 'Release force-open' : 'Force open prop'}
      </button>
    </div>
  );
}
