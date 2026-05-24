// Astro + Rozie integration — the canonical recipe from
// docs/guide/adopt-incrementally.md § Astro and
// docs/guide/for-astro-and-html-first-shops.md.
//
// Rozie's unplugin/vite adapter drops into Astro's Vite-plugin slot.
// `target: 'lit'` is the recommended default for Astro: Web Components
// hydrate without an island-bridge runtime (~6KB Lit vs ~45KB React + RDOM).
import { defineConfig } from 'astro/config';
import Rozie from '@rozie/unplugin/vite';

export default defineConfig({
  vite: {
    plugins: [Rozie({ target: 'lit' })],
  },
});
