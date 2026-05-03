// @rozie/target-react — public API for the React 18+ functional component emitter.
//
// Plan 04-02 ships emitReact with script-side lowering only; template/JSX is
// `return null;` placeholder until Plan 04-03; listeners until Plan 04-04;
// styles + source maps until Plan 04-05.
//
// @experimental — shape may change before v1.0
export { emitReact } from './emitReact.js';
export type { EmitReactOptions, EmitReactResult } from './emitReact.js';
