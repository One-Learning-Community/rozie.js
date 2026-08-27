# `$provide` / `$inject` — cross-component context

Cross-FILE token identity + reactivity-at-depth + no prop drilling, across all 6 targets. **Shipped
v0.2.0.** Unblocks compound components and declarative children (`<Node>`/`<Handle>`, `<Source>`/`<Layer>`).

## Requirements

From the `killer-component-ports` idea.

- **REQ-27 (API)** — `$provide(key, value)` / `$inject(key, fallback?)`. String `key`; `value` may be
  reactive. `$inject` is reactive at depth and usable in setup + template + reactive contexts (NOT
  `$refs`-restricted), except the Lit async edge.
- **REQ-28 (the crux — cross-FILE token identity)** — provider and consumer are separately-emitted
  modules, so the strategy SPLITS the six:
  - **Vue/Svelte** — use the author's string key natively (`provide`/`inject`, `setContext`/`getContext`)
  - **Lit** — `createContext(Symbol.for('rozie:' + key))`; `@lit/context`'s `createContext` is
    identity-on-key (`(n) => n`), so `Symbol.for` gives global identity
  - **React/Solid/Angular** — need a runtime **global registry keyed by the string**:
    `rozieContext(key)` → deduped `createContext` object; `rozieToken(key)` → deduped
    `InjectionToken`. Their tokens are identity-based, not key-based.
- **REQ-29** — reactivity at depth works through an unaware passthrough on all 6.
- **REQ-30 (Lit async edge — the documented parity divergence)** — `@lit/context`'s `ContextConsumer`
  is event-driven; the injected value can be `undefined` for the first paint until the
  `context-request` round-trip resolves. Emit a null-guard; document "possibly-null until connected".
  Upside: it crosses shadow DOM (the other 5 don't need to).
- **REQ-31 (Angular)** — emit the token in `providers`, NOT `viewProviders`. Angular exposes
  `providers` to projected (`ng-content`) descendants and hides `viewProviders` from them — and the
  compound-component pattern projects the consumer.
- **REQ-32 (Svelte)** — `setContext`/`getContext` must run during component init; reactivity requires
  a `$state`-backed value.

## Origin

Spike: 010 — sources in `sources/010-cross-component-context/`
