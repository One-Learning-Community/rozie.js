// `@rozie/unplugin/rolldown` — Rolldown plugin entry. Phase 3 exports for
// symmetry (D-48); CI matrix expands in Phase 6.
import { unplugin } from './index.js';
export const rolldownPlugin = unplugin.rolldown;
export default unplugin.rolldown;
