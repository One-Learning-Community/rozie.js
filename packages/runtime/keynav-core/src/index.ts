// @rozie/runtime-keynav-core — Phase 71 Plan 03 deliverable.
//
// The framework-neutral heart of `r-keynav`: the pure keydown state machine
// (SPEC §4 + §6), the class-token normalizer (SPEC §9, Landmine 4
// anti-drift), and the `KeynavWindower` contract (SPEC §10, design-only).
// Every per-target controller (React/Vue/Svelte/Solid/Lit hooks + the
// Angular inline controller) imports from this barrel.
//
// Tree-shakable named exports — no default export.
//
// NOTE: Task 1 populates the config/host types + windower contract only.
// `stateMachine.ts` (Task 2) and `normalizeClassTokens.ts` (Task 3) add
// their exports here as they land.

export type {
  KeynavFocusModel,
  KeynavOrientation,
  KeynavConfig,
  KeynavItemMeta,
  KeynavKeyboardEvent,
  KeynavHost,
} from './types.js';

export type { KeynavWindower, SourceArrayFallback } from './windower.js';
export { sourceArrayFallback } from './windower.js';
