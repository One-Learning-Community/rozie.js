import type { JSX } from 'react';
import ModalConsumer from '../ModalConsumer.rozie';

/**
 * Phase 07.2 Plan 06 — ModalConsumer dogfood page.
 *
 * ModalConsumer.rozie composes Modal + WrapperModal with named + scoped +
 * default-shorthand + dynamic-name + re-projection fills — exercising the
 * full consumer-side slot-fill surface Phase 07.2 ships. The compiled
 * React output uses render-prop dispatch (`renderHeader`/`renderFooter`)
 * and a `slots={{ [slotName]: () => ... }}` prop for the dynamic-name
 * fill, per the documented React divergence in docs/parity.md.
 */
export default function ModalConsumerPage(): JSX.Element {
  return (
    <div data-testid="rozie-mount">
      <h2>ModalConsumer</h2>
      <p>Dogfood: Modal + WrapperModal composed with named, scoped, default, dynamic-name, and re-projected fills.</p>
      <ModalConsumer title="Confirm action" />
    </div>
  );
}
