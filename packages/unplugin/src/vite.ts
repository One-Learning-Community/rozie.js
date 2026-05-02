/**
 * `@rozie/unplugin/vite` entry — Vite plugin factory.
 *
 * Per D-48 / Plan 06: this is the only CI-tested entry in Phase 3.
 * Consumers import as:
 *
 *   import Rozie from '@rozie/unplugin/vite';
 *   // or named:
 *   // import { vitePlugin as Rozie } from '@rozie/unplugin/vite';
 *
 *   export default defineConfig({
 *     plugins: [Rozie({ target: 'vue' }), vue()],   // BEFORE vue() per D-25
 *   });
 *
 * @experimental — shape may change before v1.0
 */
import { unplugin } from './index.js';
export const vitePlugin = unplugin.vite;
export default unplugin.vite;
