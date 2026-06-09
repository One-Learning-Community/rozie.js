<script lang="ts">
import { applyListeners, rozieAttr } from '@rozie/runtime-svelte';

interface Props {
  [key: string]: unknown;
}

let { ...__rozieAttrs }: Props = $props();

let cond = $state(false);
let maybeNull: any = $state(null);
</script>

<div {...__rozieAttrs} class={["attr-nullish-drop", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f2d28246><span data-x={rozieAttr(cond ? 'v' : null)} aria-expanded={rozieAttr(cond ? 'true' : 'false')} title={rozieAttr(maybeNull)} data-rozie-s-f2d28246>probe</span></div>
