import { createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import Dropdown from '../../../../Dropdown.rozie';

/**
 * DropdownPage — wraps Dropdown.rozie with parent-controlled `open` state for
 * the SC #2 parent-flip-mid-lifecycle Playwright e2e test.
 *
 * Provides a "Lock closed" toggle so the Playwright spec can simulate the parent
 * ignoring close requests (parent-flip scenario). When locked, the `onOpenChange`
 * handler does NOT propagate the state change, proving the Solid reactive accessor
 * reads the LATEST value (no stale-prop — SC #2 / SOLID-T-02).
 */
export default function DropdownPage() {
  const [open, setOpen] = createSignal(false);
  const [lockedClosed, setLockedClosed] = createSignal(false);

  return (
    <div>
      <h2>Dropdown</h2>
      <Dropdown
        open={open()}
        onOpenChange={(v: boolean) => {
          if (lockedClosed()) return; // simulate parent ignoring close requests
          setOpen(v);
        }}
        closeOnOutsideClick={true}
        closeOnEscape={true}
        triggerSlot={({ open: isOpen }: { open: boolean; toggle: () => void }) => (
          <button class="dropdown-trigger" data-testid="dropdown-trigger">
            Toggle ({isOpen ? 'open' : 'closed'})
          </button>
        ) as JSX.Element}
      >
        <ul class="dropdown-items" data-testid="dropdown-items">
          <li>Item A</li>
          <li>Item B</li>
          <li>Item C</li>
        </ul>
      </Dropdown>
      <p>
        Open: <span data-testid="dropdown-open-state">{String(open())}</span>
      </p>
      <button
        data-testid="parent-lock"
        onClick={() => setLockedClosed(true)}
      >
        Lock closed
      </button>
      <button
        data-testid="parent-unlock"
        onClick={() => setLockedClosed(false)}
      >
        Unlock
      </button>
    </div>
  );
}
