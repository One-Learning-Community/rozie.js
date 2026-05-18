/**
 * @rozie/runtime-svelte — Svelte 5 helpers used by emitted wrappers.
 *
 * Currently only ships the portal-slot primitive's PortalHost component
 * (Spike 003). The `.svelte` file is exported via the package's "./PortalHost.svelte"
 * entry; emitted wrappers import it directly:
 *
 *   import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
 *
 * Per REQ-8 (Spike 003 locked design): Svelte 5 Snippets cannot be
 * mount()-ed directly — only Components can. PortalHost is the ~10-LOC
 * shim that wraps any Snippet for imperative mounting into a foreign
 * container. Lives in this runtime package (not synthesized per-component)
 * so consumers don't ship an extra ~25 LOC per Rozie source that uses
 * portal slots.
 *
 * Side note: this index.ts is a documentation hook; consumers do not
 * import anything from here directly.
 */

export {};
