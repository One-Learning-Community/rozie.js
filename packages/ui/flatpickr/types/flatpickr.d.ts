/**
 * Gate-only loose ambient for `flatpickr`, used ONLY by the leaf
 * `tsc --noEmit` typecheck gates (wired via each tsc-running leaf's tsconfig
 * `paths`). NOT shipped — it lives outside every leaf's `src`/`files`, so
 * consumers still resolve flatpickr's real published types.
 *
 * Why: flatpickr's published types declare strict option unions (e.g.
 * `mode: "single" | "multiple" | "range" | "time"`). The emitted, runtime-correct
 * engine call passes the component's `string`-typed props straight through, so
 * `tsc` reports a TS2769 overload mismatch against the real types — third-party
 * author-strictness the generated code does not satisfy (flatpickr accepts a
 * string at runtime). Every other typecheck gate in the repo stubs the engine
 * loosely for exactly this reason (tests/*-typecheck/engine-modules.d.ts). This
 * keeps the leaf gate focused on emit-shape correctness (helper imports, hook
 * signatures, slot/merge types) without coupling it to flatpickr's option-literal
 * strictness. (Leaf-strict-typecheck emitter finding; cf. the memory note
 * project_leaf_strict_typecheck_emitter_findings — relax the gate, the emit is
 * runtime-correct.)
 */
declare const flatpickr: (...args: any[]) => any;
export default flatpickr;
