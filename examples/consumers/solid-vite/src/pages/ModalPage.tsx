import { createSignal } from 'solid-js';
import Modal from '../../../../Modal.rozie';

/**
 * ModalPage — wraps Modal.rozie with parent-controlled `open` state.
 */
export default function ModalPage() {
  const [open, setOpen] = createSignal(false);
  const [closeCount, setCloseCount] = createSignal(0);

  return (
    <div>
      <h2>Modal</h2>
      <button data-testid="open-modal" onClick={() => setOpen(true)}>
        Open Modal
      </button>
      <Modal
        open={open()}
        onOpenChange={setOpen}
        closeOnEscape={true}
        closeOnBackdrop={true}
        lockBodyScroll={true}
        title="Hello from Modal.rozie"
        onClose={() => setCloseCount((c) => c + 1)}
      >
        <p>Modal body content. Close via Escape, backdrop click, or the × button.</p>
      </Modal>
      {closeCount() > 0 && (
        <p data-testid="close-count">Closed {closeCount()} time(s)</p>
      )}
    </div>
  );
}
