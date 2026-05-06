import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import Rozie from '@rozie/unplugin/vite';

// Phase 5 Plan 05-01 Wave 0 — Rozie wired BEFORE svelte() per RESEARCH.md
// Pattern (mirrors Phase 3/4 Vue/React demos). Path-virtual chain:
// Rozie's resolveId rewrites `Foo.rozie` → `<abs>/Foo.rozie.svelte`; load
// returns the compiled Svelte SFC source; @sveltejs/vite-plugin-svelte
// picks it up via its default `/\.svelte$/` transformInclude.
//
// Plan 05-02 Task 4 wires the Svelte branch into @rozie/unplugin and
// flips this demo from "expects ROZ402 not-yet-supported error" to
// "renders Counter/Dropdown/SearchInput/TodoList/Modal correctly."
export default defineConfig({
  plugins: [
    Rozie({ target: 'svelte' }),
    svelte(),
  ],
  build: {
    sourcemap: true, // DX-01 requirement — Phase 6 covers Svelte source maps
  },
  server: {
    port: 5174, // distinct from vue-vite (5173) and react-vite (5175)
  },
});
