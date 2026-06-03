import { useState } from 'react';
import type { JSX } from 'react';
import Modal from '../Modal.rozie';

/**
 * ModalPage — wraps Modal.rozie with parent-controlled `open` state. Anchor
 * for both the modal-strictmode Playwright e2e (REACT-T-06 + Pitfall 3 —
 * body.style.overflow correctness across mount/unmount under StrictMode) and
 * the OQ4 disposition test (Modal works WITHOUT $expose).
 *
 * Phase 25 (canonical-wins drift): canonical Modal.rozie locks body scroll in a
 * `$onMount(lockScroll)` / `$onUnmount(unlockScroll)` pair — the lock fires when
 * the Modal COMPONENT mounts, not when `open` flips (the old demo copy used a
 * `$watch(() => $props.open)`). To preserve the symmetric "locked only while
 * open" contract the Pitfall-3 specs assert, the page now CONDITIONALLY MOUNTS
 * the Modal (`{open && <Modal .../>}`): opening mounts it → `$onMount` locks;
 * closing unmounts it → `$onUnmount` restores. This is a demo-wrapper change
 * faithful to canonical Modal's mount-scoped lifecycle (canonical source is the
 * single source of truth and is NOT edited).
 */
export default function ModalPage(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [closeCount, setCloseCount] = useState(0);

  return (
    <div>
      <h2>Modal</h2>
      <button data-testid="open-modal" onClick={() => setOpen(true)}>
        Open Modal
      </button>
      {open && (
        <Modal
          open={open}
          onOpenChange={setOpen}
          closeOnEscape={true}
          closeOnBackdrop={true}
          lockBodyScroll={true}
          title="Hello from Modal.rozie"
          onClose={() => setCloseCount((c) => c + 1)}
        >
          {() => (
            <p>Modal body content. Close via Escape, backdrop click, or the × button.</p>
          )}
        </Modal>
      )}
      {closeCount > 0 && (
        <p data-testid="close-count">Closed {closeCount} time(s)</p>
      )}
    </div>
  );
}
