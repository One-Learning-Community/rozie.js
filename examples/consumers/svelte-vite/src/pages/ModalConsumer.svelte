<!--
  Phase 07.2 Plan 06 — ModalConsumer dogfood page (Wave 2 close-out).

  ModalConsumer.rozie composes Modal + WrapperModal with named + scoped +
  default-shorthand + dynamic-name + re-projected fills — the full surface
  Phase 07.2 ships. The compiled Svelte output uses {#snippet header(...)}
  blocks and a snippets={{ [slotName]: __rozieDynSlot_N }} prop for the
  dynamic-name fill, per Plan 07.2-04 emit shape.
-->
<script lang="ts">
  import ModalConsumer from '../ModalConsumer.rozie';
</script>

<div data-testid="rozie-mount">
  <h2>ModalConsumer Demo</h2>
  <p>Dogfood: Modal + WrapperModal composed with named, scoped, default, dynamic-name, and re-projected fills.</p>
  <ModalConsumer title="Confirm action" />
</div>

<style>
  div {
    padding: 1rem;
  }
</style>
