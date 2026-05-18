<!--
  PortalHost — Spike 003 portal-slot primitive helper for Svelte 5.

  Svelte 5 Snippets can NOT be passed to `mount()` directly — `mount()`
  expects a Component. This shim wraps an arbitrary Snippet so it can be
  mounted into a foreign DOM container (FullCalendar cell, AG-Grid cell,
  Swiper slide, etc.).

  Emitted Rozie wrappers import it as:
    import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
  …and pass the consumer's snippet + scope object as props.

  Per REQ-5: portal slots are NOT reactive after mount in v1. Re-render
  happens only when the wrapper script re-invokes the portals closure
  (which unmounts and re-mounts a fresh PortalHost). Future versions may
  add a reactive variant that subscribes to scope changes.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    snippet: Snippet<[unknown]>;
    scope: unknown;
  }

  let { snippet, scope }: Props = $props();
</script>

{@render snippet(scope)}
