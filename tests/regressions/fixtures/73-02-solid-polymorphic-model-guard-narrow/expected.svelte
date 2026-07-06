<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  value?: string | any;
  [key: string]: unknown;
}

let { value = $bindable(''), ...__rozieAttrs }: Props = $props();

// project_solid_polymorphic_model_typeof_narrow_gap / emitter-hardening
// backlog item #11: capturing the guard-and-reread pattern directly (no
// author-side workaround) — the emitter must bind a local before the guard
// so the narrowing holds uniformly on all six targets.
const selected = (): string => typeof value === 'string' ? value : '';
</script>

<div {...__rozieAttrs} class={["selected", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-afea58c3>{rozieDisplay(selected())}</div>

<style>
:global {
  .selected[data-rozie-s-afea58c3] { font-variant-numeric: tabular-nums; }
}
</style>
