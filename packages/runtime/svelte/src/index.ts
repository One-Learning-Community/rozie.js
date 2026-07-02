/**
 * @rozie/runtime-svelte — Svelte 5 helpers used by emitted wrappers.
 *
 * Ships two helpers:
 *
 *   - `PortalHost` (Spike 003) — the portal-slot primitive. Exported via the
 *     package's `./PortalHost.svelte` entry; emitted wrappers import it
 *     directly: `import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';`
 *     Per REQ-8: Svelte 5 Snippets cannot be `mount()`-ed directly — only
 *     Components can. PortalHost is the ~10-LOC shim that wraps any Snippet
 *     for imperative mounting into a foreign container.
 *
 *   - `applyListeners` (Phase 15 — D-11 lock) — Svelte 5 action attaching
 *     an event-listener object to a node with diff-on-update and
 *     destroy-on-detach lifecycle. Emitted as `use:applyListeners={obj}`
 *     for the dynamic listener-fallthrough path; literal-key spreads emit
 *     per-key `on:click={fn}` directives at compile time.
 *
 *     This is the FIRST real `index.ts` export beyond PortalHost — the
 *     package's earlier `export {};` documentation stub transitioned to
 *     a real export in Phase 15 Plan 15-04.
 *
 *   - `keynav` (Phase 71 — `r-keynav` Svelte target-pair) — the Svelte 5
 *     action driving `@rozie/runtime-keynav-core`'s framework-neutral state
 *     machine. Emitted as `use:keynav={{ config, active, getSource,
 *     getActive, setActive, onCommit, activeClass?, windower? }}` on the
 *     `r-keynav` root element. See `keynav.ts`'s module doc comment for why
 *     this is an action `update()`, not a separate `$effect` block.
 */

export { applyListeners } from './applyListeners.js';
export { rozieDisplay } from './rozieDisplay.js';
export { rozieAttr } from './rozieAttr.js';
export { rozieClass } from './rozieClass.js';
export { rozieStyle } from './rozieStyle.js';
export { keynav, type KeynavActionOpts } from './keynav.js';
