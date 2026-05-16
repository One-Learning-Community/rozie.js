import ModalConsumer from '../../../../ModalConsumer.rozie';

/**
 * Phase 07.2 Plan 06 — ModalConsumer dogfood page (Wave 2 close-out).
 *
 * ModalConsumer.rozie composes Modal + WrapperModal with named + scoped +
 * default-shorthand + dynamic-name + re-projected fills. The compiled Solid
 * output uses headerSlot/footerSlot props for named fills + `slots={{
 * [slotName()]: () => ... }}` for the dynamic-name fill (signal auto-call).
 */
export default function ModalConsumerPage() {
  return (
    <div data-testid="rozie-mount">
      <h2>ModalConsumer Demo</h2>
      <p>Dogfood: Modal + WrapperModal composed with named, scoped, default, dynamic-name, and re-projected fills.</p>
      <ModalConsumer title="Confirm action" />
    </div>
  );
}
