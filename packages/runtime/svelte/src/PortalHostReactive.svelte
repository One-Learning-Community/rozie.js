<!--
  PortalHostReactive — Phase 33 reactive portal-slot host for Svelte 5 (REQ-19).

  The mount-once sibling (packages/runtime/svelte/src/PortalHost.svelte) takes
  `{ snippet, scope }` and renders `{@render snippet(scope)}` ONCE — `mount()`
  props are NOT reactive, so there is no in-place update path.

  The REACTIVE variant:
   1. holds `scope` in component-local `$state` (a valid $state position —
      component instance top-level), seeded ONCE from `initialScope`,
   2. exposes an `update(s)` EXPORT. Svelte 5 `mount()` returns the component's
      exports, so the wrapper's reactive portal closure can call
      `inst.update(newScope)` to drive an in-place re-render,
   3. re-renders `{@render snippet(scope)}` when `scope` changes — same DOM,
      no remount (mount/unmount is only on dispose).

  The `state_referenced_locally` hint on the seed line is correct-by-design
  (Spike 007 Surprise #1 → REQ-19): we deliberately seed `scope` ONCE and drive
  updates through the `update()` export (engine-driven), never via
  prop-reactivity — so the svelte-ignore keeps the build clean.

  Emitted Rozie wrappers import it as:
    import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
  …and pass the consumer's snippet + initial scope object as props, retaining the
  returned instance to call `inst.update(newScope)`.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    snippet: Snippet<[unknown]>;
    initialScope: unknown;
  }

  let { snippet, initialScope }: Props = $props();
  // svelte-ignore state_referenced_locally
  let scope = $state(initialScope);

  // Svelte 5: exported functions are returned by mount(); this is the
  // engine-driven update handle.
  export function update(s: unknown): void {
    scope = s;
  }
</script>

{@render snippet(scope)}
