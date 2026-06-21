<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

const tickK = () => base * 2;
// columnChromeK — the run-LEADING comment that flows directly below the host `const tickK`
// arrow const (gap-0 seam; no hoisted import — the arrow bodies close over host scope, the
// real DataTable columnChrome shape). This block is the partial's first surviving decl's
// leading comment; it transfers into the host verbatim (doubled on svelte/vue per-statement),
// so the inline oracle carries the IDENTICAL block directly below its own `const tickK`.
// columnChromeK — the run-LEADING comment that flows directly below the host `const tickK`
// arrow const (gap-0 seam; no hoisted import — the arrow bodies close over host scope, the
// real DataTable columnChrome shape). This block is the partial's first surviving decl's
// leading comment; it transfers into the host verbatim (doubled on svelte/vue per-statement),
// so the inline oracle carries the IDENTICAL block directly below its own `const tickK`.
const ariaSortK = (n: number): number => tickK() + n;
const sortIndicatorK = (n: number): number => ariaSortK(n) + 1;
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-8263a79a><span class="echo" data-rozie-s-8263a79a>{rozieDisplay(ariaSortK(1))}</span><span class="echo" data-rozie-s-8263a79a>{rozieDisplay(sortIndicatorK(1))}</span></div>
