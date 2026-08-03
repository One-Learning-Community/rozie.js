<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  maybeNullProp?: (string) | null;
  [key: string]: unknown;
}

let { maybeNullProp = null, ...__rozieAttrs }: Props = $props();

let cond = $state(false);
let maybeNull: any = $state(null);
let loopItems = $state(['a', 'b']);
</script>

<div {...__rozieAttrs} class={["attr-nullish-drop", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f2d28246><span data-x={rozieAttr(cond ? 'v' : null)} aria-expanded={rozieAttr(cond ? 'true' : 'false')} title={rozieAttr(maybeNull)} data-rozie-s-f2d28246>probe</span><span class="attr-nullish-drop-prop" title={maybeNullProp} data-rozie-s-f2d28246>probe-prop</span>{#each loopItems as c (c)}<i class="attr-nullish-drop-loop" title={maybeNullProp} data-rozie-s-f2d28246>{rozieDisplay(c)}</i>{/each}</div>
