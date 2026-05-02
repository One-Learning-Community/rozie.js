// `@rozie/unplugin/rollup` — Rollup plugin entry. Phase 3 exports for
// symmetry (D-48); CI matrix expands in Phase 6.
import { unplugin } from './index.js';
export const rollupPlugin = unplugin.rollup;
export default unplugin.rollup;
