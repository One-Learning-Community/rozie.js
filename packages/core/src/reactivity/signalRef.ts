/**
 * Reactive dependency reference produced by ReactiveDepGraph.
 *
 * Consumed by every target emitter (Phase 3+); the React emitter (Phase 4) is
 * the strictest user — it embeds these refs verbatim into `useEffect` /
 * `useMemo` / `useCallback` dep arrays. Wrong shape here = ESLint
 * `react-hooks/exhaustive-deps` warnings in user codebases.
 *
 * The shape mirrors `eslint-plugin-react-hooks/exhaustive-deps`'s notion of a
 * "dependency root" per `gatherDependenciesRecursively` — a {scope, identifier}
 * tuple where `scope` distinguishes WHERE the value comes from (props/data/
 * computed/slots/closure) and `path[0]` is the root identifier (path narrowing
 * per Pitfall 1).
 *
 * @experimental — shape may change before v1.0
 */
export type SignalRef =
  /** $props.foo.bar.baz → { scope: 'props', path: ['foo'] } (root narrowed). */
  | { scope: 'props'; path: string[] }
  /** $data.foo.bar → { scope: 'data', path: ['foo'] }. */
  | { scope: 'data'; path: string[] }
  /** Top-level $computed declarations bound at component scope. */
  | { scope: 'computed'; path: string[] }
  /** $slots.foo presence/value reads (Pitfall 5 — slots ARE reactive). */
  | { scope: 'slots'; path: string[] }
  /**
   * quick 260807-cor (D4) — `$slotted.<name>` member reads. `path[0]` is the
   * slot key ('default' for the unnamed slot, else the authored `name="X"`
   * string).
   *
   * LIVE ONLY ON LIT: the sigil resolves the light-DOM elements currently
   * assigned to a slot ACROSS a shadow boundary (`assignedElements()`).
   * React/Vue/Svelte/Solid/Angular have no shadow boundary — slot content is
   * already a real descendant there — so the sigil is a COMPILE-TIME CONSTANT
   * `[]` on those five targets and must never enter a React dependency array
   * (a constant can never legitimately change, so a dep entry for it would
   * only churn effect identity on every parent render for no reactive
   * benefit — see react/src/emit/renderDepArray.ts + emit/emitScript.ts,
   * both of which drop this scope explicitly rather than falling through to
   * a rendered dep).
   */
  | { scope: 'slotted'; path: string[] }
  /** D-21: helper-function dep, opaque at body boundary. `identifier` is the captured name. */
  | { scope: 'closure'; identifier: string };
