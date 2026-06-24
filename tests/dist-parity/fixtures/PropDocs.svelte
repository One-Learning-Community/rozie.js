<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  /**
   * The visible text label for the control.
   * @deprecated Use `text` instead — `label` is retained only for back-compat.
   * @example
   * <PropDocs label="Save" />
   */
  label?: string;
  count?: number;
  [key: string]: unknown;
}

let {
  label = '',
  count = 0,
  ...__rozieAttrs
}: Props = $props();
</script>

<div {...__rozieAttrs} class={["prop-docs", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-727424de><span class="label" data-rozie-s-727424de>{label}</span><span class="count" data-rozie-s-727424de>{count}</span></div>

<style>
:global {
  .prop-docs[data-rozie-s-727424de] { display: inline-flex; gap: 0.5rem; align-items: center; }
  .label[data-rozie-s-727424de] { font-weight: 600; }
  .count[data-rozie-s-727424de] { font-variant-numeric: tabular-nums; }
}
</style>
