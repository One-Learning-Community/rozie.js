# @rozie/runtime-svelte

Source-shipped Svelte 5 runtime helpers consumed by components emitted by `@rozie/target-svelte`. Provides the two behaviors that don't have a 1:1 Svelte equivalent — the portal-slot host primitive and the dynamic event-listener action — plus crash-safe interpolation, so the emitter can stay declarative and the runtime cost stays minimal.

## Status

Shipped. Used end-to-end by the Svelte reference examples and engine-wrapper demos (notably the portal-slot primitive and dynamic listener-fallthrough path), and validated through the Svelte visual-regression matrix. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). It is declared as a peer dependency of `@rozie/unplugin`, so projects using the unplugin must install both. This package ships its source directly (no build step) and is consumed through Svelte's `svelte` export condition.

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/runtime-svelte": "workspace:*",
    "svelte": "^5"
  }
}
```

## Usage

You normally do not import this package by hand — `@rozie/target-svelte` injects the imports it needs into emitted SFCs. The published shape, for reference:

```svelte
<script>
  import { applyListeners } from '@rozie/runtime-svelte';
  import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
</script>

<!-- Dynamic listener-fallthrough action emitted from a .rozie file: -->
<button use:applyListeners={listeners}>…</button>
```

## Public exports

- **Action:** `applyListeners` — Svelte 5 action attaching an event-listener object with diff-on-update / destroy-on-detach lifecycle (also available via the `./applyListeners` subpath)
- **Interpolation:** `rozieDisplay` (Phase 26 safe non-primitive interpolation — `toDisplayString` semantics, crash-safe)
- **Component subpath:** `./PortalHost.svelte` — the portal-slot primitive that wraps a Snippet for imperative mounting into a foreign container

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
