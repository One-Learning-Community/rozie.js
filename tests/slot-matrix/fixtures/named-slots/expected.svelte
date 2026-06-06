<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  header?: Snippet;
  footer?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  header: __headerProp,
  footer: __footerProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const footer = $derived(__footerProp ?? snippets?.footer);
</script>

<div {...__rozieAttrs} class={["named-slots-fixture", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-a30182bc><header data-rozie-s-a30182bc>{@render header?.()}</header><footer data-rozie-s-a30182bc>{@render footer?.()}</footer></div>
