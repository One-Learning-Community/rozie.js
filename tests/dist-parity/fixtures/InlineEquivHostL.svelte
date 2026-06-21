<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import { setContext } from 'svelte';

interface Props {
  base?: number;
  [key: string]: unknown;
}

let { base = 1, ...__rozieAttrs }: Props = $props();

const headL = () => base + 1;
// the registry API handed to children (the $provide leading comment that STAYS in
// residual position when $provide lowers to provide()/Provider — the real shape).
// imperative handle (consumer-callable) — the run-LEADING comment block that is
// SEPARATED from the host predecessor by one blank line (beforeGap=2). Inline, the
// blank breaks @babel's prev-trailing attachment, so this block attaches to verbL's
// leadingComments ONLY → single-emit on svelte/vue. The partial-splice mirror must
// NOT re-create the prev-trailing copy (doubling it = the R10 bug this guards).
const verbL = (n: number): number => headL() + n;
const verb2L = (n: number): number => verbL(n) + 1;

setContext('themeL', {
  v: 1
});
</script>

<div {...__rozieAttrs} class={["partial-inline-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-6bfa9f0a><span class="echo" data-rozie-s-6bfa9f0a>{rozieDisplay(verbL(1))}</span><span class="echo" data-rozie-s-6bfa9f0a>{rozieDisplay(verb2L(1))}</span></div>
