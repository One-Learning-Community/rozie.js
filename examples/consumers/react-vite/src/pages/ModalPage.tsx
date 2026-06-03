import { useState } from 'react';
import type { JSX } from 'react';
import Modal from '../Modal.rozie';

/**
 * ModalPage — wraps Modal.rozie with parent-controlled `open` state. Anchor
 * for both the modal-strictmode Playwright e2e (REACT-T-06 + Pitfall 3 —
 * body.style.overflow correctness across open/close under StrictMode) and
 * the OQ4 disposition test (Modal works WITHOUT $expose).
 *
 * The Modal is ALWAYS MOUNTED and driven by the controlled `open` prop —
 * the natural usage for a two-way-bound (`open: { model: true }`) component.
 * Canonical Modal.rozie reacts to `open` toggling via `$watch(() => $props.open)`
 * (the cross-target primitive): opening locks body scroll, closing restores it.
 * The `$onUnmount(unlockScroll)` pair only anchors the unmount-time restore.
 * The Pitfall-3 "locked only while open" body.style.overflow contract therefore
 * holds without conditionally mounting the component.
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
      {closeCount > 0 && (
        <p data-testid="close-count">Closed {closeCount} time(s)</p>
      )}
    </div>
  );
}
