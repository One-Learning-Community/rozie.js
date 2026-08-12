---
"@rozie/core": patch
"@rozie/cli": patch
"@rozie/unplugin": patch
"@rozie/babel-plugin": patch
---

Lit target: multi-word `$emit()` names are now dispatched kebab-cased, so they actually reach the consumer's listener. Compiling a component that calls `$emit('regionIn', payload)` previously emitted `dispatchEvent(new CustomEvent('regionIn', …))` — the raw camelCase source name — while the consumer's `@region-in="…"` template binding compiled to a hyphenated `addEventListener('region-in', …)`. `addEventListener` is case-sensitive, so a multi-word emit never fired its listener; single-word names were immune by construction, which is why this went unnoticed. Both `$emit` lowering sites (script-statement position and template/listener-expression position) now kebab-case the dispatched event name using the same algorithm the Lit two-way model event path already used, so the dispatch side and the model path cannot drift apart.
