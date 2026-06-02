import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import Rozie from '@rozie/unplugin/vite';
import { rozieCodegen } from './rozie-codegen';
import { diagnosticsCodegen } from './diagnostics-codegen';

const rozieGrammar = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../tools/textmate/syntaxes/rozie.tmLanguage.json', import.meta.url)),
    'utf8',
  ),
);

// Repo-root `examples/` dir — source for the live-compiled example pages.
const examplesDir = fileURLToPath(new URL('../../examples', import.meta.url));

// The compiler's diagnostic-code registry — source for the generated
// ROZ-code reference page (`/reference/diagnostics`).
const codesPath = fileURLToPath(
  new URL('../../packages/core/src/diagnostics/codes.ts', import.meta.url),
);

export default defineConfig({
  title: 'Rozie.js',
  description:
    'Write components once in a Vue/Alpine-flavored syntax. Ship idiomatic React, Vue, Svelte, Angular, Solid, and Lit web components.',
  base: '/rozie.js/',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    languages: [
      {
        ...rozieGrammar,
        name: 'rozie',
      },
    ],
    // The rozie grammar embeds `source.js` and `source.css` inside <script>,
    // <props>, <data>, <listeners>, <components>, and <style> blocks. Shiki's
    // strict loader rejects custom languages whose dependencies aren't already
    // in the registry — preload them here before the markdown renderer runs.
    async shikiSetup(highlighter) {
      await highlighter.loadLanguage('javascript', 'css');
    },
    // Live-compile the example pages: `rozie-src` / `rozie-out` fences are
    // regenerated from the actual `.rozie` source through `@rozie/core` on
    // every build, so the docs can never drift from the compiler.
    config(md) {
      rozieCodegen(md, { examplesDir });
      diagnosticsCodegen(md, { codesPath });
    },
  },
  // Dogfood the project: compile .rozie files inline through the unplugin so
  // example pages can embed the *actual* components they document. Rozie
  // emits Vue SFC text; VitePress's bundled vue plugin then takes it the
  // rest of the way.
  vite: {
    plugins: [Rozie({ target: 'vue' })],
  },
  themeConfig: {
    // Built-in minisearch-backed local search — index is generated at build
    // time, no external service required.
    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },
    nav: [
      { text: 'Guide', link: '/guide/why' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Compatibility', link: '/compatibility' },
      { text: 'GitHub', link: 'https://github.com/One-Learning-Community/rozie.js' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Why Rozie?', link: '/guide/why' },
            { text: 'Why Rozie looks this way', link: '/guide/design-rationale' },
            { text: 'Install', link: '/guide/install' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Features & design choices', link: '/guide/features' },
            { text: 'Compatibility', link: '/compatibility' },
            { text: 'Cross-Framework Parity', link: '/parity' },
          ],
        },
        {
          text: 'Adoption',
          items: [
            { text: 'Adopt incrementally', link: '/guide/adopt-incrementally' },
            { text: 'Creature comforts', link: '/guide/creature-comforts' },
            { text: 'For Angular shops', link: '/guide/for-angular-shops' },
            { text: 'For React teams', link: '/guide/for-react-teams' },
            { text: 'For Preact teams', link: '/guide/for-preact-teams' },
            { text: 'For Lit / Web Components teams', link: '/guide/for-lit-teams' },
            { text: 'For Astro / HTML-first shops', link: '/guide/for-astro-and-html-first-shops' },
            { text: 'For vanilla-JS + plugin shops', link: '/guide/for-vanilla-js-shops' },
          ],
        },
        {
          text: '@rozie-ui/sortable-list',
          items: [
            { text: 'SortableList — showcase & API', link: '/guide/sortable-list' },
            { text: 'Sortable libraries comparison', link: '/guide/sortable-comparison' },
            { text: 'SortableList example & output', link: '/examples/sortable-list' },
          ],
        },
        {
          text: '@rozie-ui/flatpickr',
          items: [
            { text: 'Flatpickr — showcase & API', link: '/guide/flatpickr' },
            { text: 'Flatpickr libraries comparison', link: '/guide/flatpickr-comparison' },
            { text: 'Flatpickr example & output', link: '/examples/flatpickr' },
          ],
        },
      ],
      '/compatibility': [
        {
          text: 'Reference',
          items: [
            { text: 'Compatibility', link: '/compatibility' },
            { text: 'Cross-Framework Parity', link: '/parity' },
            { text: 'Diagnostics (ROZ codes)', link: '/reference/diagnostics' },
          ],
        },
      ],
      '/parity': [
        {
          text: 'Reference',
          items: [
            { text: 'Compatibility', link: '/compatibility' },
            { text: 'Cross-Framework Parity', link: '/parity' },
            { text: 'Diagnostics (ROZ codes)', link: '/reference/diagnostics' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Compatibility', link: '/compatibility' },
            { text: 'Cross-Framework Parity', link: '/parity' },
            { text: 'Diagnostics (ROZ codes)', link: '/reference/diagnostics' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Counter', link: '/examples/counter' },
            { text: 'SearchInput', link: '/examples/search-input' },
            { text: 'Modal', link: '/examples/modal' },
            { text: 'Dropdown', link: '/examples/dropdown' },
            { text: 'TreeNode', link: '/examples/tree-node' },
            { text: 'Card (with CardHeader)', link: '/examples/card' },
            { text: 'TodoList', link: '/examples/todo-list' },
            { text: 'Table', link: '/examples/table' },
            { text: 'PortalList (portal-slot primitive)', link: '/examples/portal-list' },
            { text: 'SortableList (drag & drop)', link: '/examples/sortable-list' },
            { text: 'Flatpickr (date picker)', link: '/examples/flatpickr' },
            { text: 'LineChart (Chart.js)', link: '/examples/line-chart' },
            { text: 'SCSS styling', link: '/examples/scss' },
            { text: 'TypeScript authoring', link: '/examples/typescript' },
          ],
        },
      ],
    },
    socialLinks: [],
    footer: {
      message: 'Pre-v1.0 — internal monorepo.',
    },
  },
});
