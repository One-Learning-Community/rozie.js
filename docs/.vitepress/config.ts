import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import Rozie from '@rozie/unplugin/vite';
import { rozieCodegen } from './rozie-codegen';
import { diagnosticsCodegen } from './diagnostics-codegen';
import { propsCodegen } from './props-codegen';

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
  // Contributor/maintainer guides that live under docs/ but are NOT site pages
  // (they contain bare <slug>/<Name> tokens the VitePress Vue compiler would try
  // to parse as unclosed elements). Keep them co-located but out of the build.
  srcExclude: ['ADDING-COMPONENT-DOCS.md'],
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
      propsCodegen(md, { examplesDir });
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
      { text: 'Components', link: '/components/' },
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
            { text: 'How Rozie compares (Mitosis, Stencil)', link: '/guide/how-rozie-compares' },
            { text: 'Install', link: '/guide/install' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Features & design choices', link: '/guide/features' },
            { text: 'Script partials (.rzts / .rzjs)', link: '/guide/script-partials' },
            { text: 'Compatibility', link: '/compatibility' },
            { text: 'Cross-Framework Parity', link: '/parity' },
            { text: 'Security & supply chain', link: '/guide/security' },
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
      ],
      '/components/': [
        {
          text: 'Overview',
          items: [{ text: 'All components', link: '/components/' }],
        },
        {
          text: '@rozie-ui/sortable-list',
          collapsed: true,
          items: [
            { text: 'SortableList — showcase & API', link: '/components/sortable-list' },
            { text: 'Usage examples', link: '/components/sortable-list-usage' },
            { text: 'Sortable libraries comparison', link: '/components/sortable-comparison' },
            { text: 'SortableList example & output', link: '/examples/sortable-list' },
            { text: 'SortableList — live demo', link: '/components/sortable-list-demo' },
          ],
        },
        {
          text: '@rozie-ui/flatpickr',
          collapsed: true,
          items: [
            { text: 'Flatpickr — showcase & API', link: '/components/flatpickr' },
            { text: 'Usage examples', link: '/components/flatpickr-usage' },
            { text: 'Flatpickr libraries comparison', link: '/components/flatpickr-comparison' },
            { text: 'Flatpickr example & output', link: '/examples/flatpickr' },
            { text: 'Flatpickr — live demo', link: '/components/flatpickr-demo' },
          ],
        },
        {
          text: '@rozie-ui/fullcalendar',
          collapsed: true,
          items: [
            { text: 'FullCalendar — showcase & API', link: '/components/fullcalendar' },
            { text: 'Usage examples', link: '/components/fullcalendar-usage' },
            { text: 'FullCalendar libraries comparison', link: '/components/fullcalendar-comparison' },
            { text: 'FullCalendar — live demo', link: '/components/fullcalendar-demo' },
          ],
        },
        {
          text: '@rozie-ui/codemirror',
          collapsed: true,
          items: [
            { text: 'CodeMirror — showcase & API', link: '/components/codemirror' },
            { text: 'Usage examples', link: '/components/codemirror-usage' },
            { text: 'CodeMirror libraries comparison', link: '/components/codemirror-comparison' },
            { text: 'CodeMirror — live demo', link: '/components/codemirror-demo' },
          ],
        },
        {
          text: '@rozie-ui/chartjs',
          collapsed: true,
          items: [
            { text: 'Chart.js — showcase & API', link: '/components/chartjs' },
            { text: 'Usage examples', link: '/components/chartjs-usage' },
            { text: 'Chart.js libraries comparison', link: '/components/chartjs-comparison' },
            { text: 'Chart.js — live demo', link: '/components/chartjs-demo' },
          ],
        },
        {
          text: '@rozie-ui/tiptap',
          collapsed: true,
          items: [
            { text: 'TipTap — showcase & API', link: '/components/tiptap' },
            { text: 'Usage examples', link: '/components/tiptap-usage' },
            { text: 'TipTap libraries comparison', link: '/components/tiptap-comparison' },
            { text: 'TipTap — live demo', link: '/components/tiptap-demo' },
          ],
        },
        {
          text: '@rozie-ui/maplibre',
          collapsed: true,
          items: [
            { text: 'MapLibre — showcase & API', link: '/components/maplibre' },
            { text: 'Usage examples', link: '/components/maplibre-usage' },
            { text: 'MapLibre libraries comparison', link: '/components/maplibre-comparison' },
            { text: 'MapLibre — live demo', link: '/components/maplibre-demo' },
          ],
        },
        {
          text: '@rozie-ui/cropper',
          collapsed: true,
          items: [
            { text: 'Cropper — showcase & API', link: '/components/cropper' },
            { text: 'Usage examples', link: '/components/cropper-usage' },
            { text: 'Cropper libraries comparison', link: '/components/cropper-comparison' },
            { text: 'Cropper — live demo', link: '/components/cropper-demo' },
          ],
        },
        {
          text: '@rozie-ui/captcha',
          collapsed: true,
          items: [
            { text: 'Captcha — showcase & API', link: '/components/captcha' },
            { text: 'Usage examples', link: '/components/captcha-usage' },
            { text: 'Captcha libraries comparison', link: '/components/captcha-comparison' },
            { text: 'Captcha — live demo', link: '/components/captcha-demo' },
          ],
        },
        {
          text: '@rozie-ui/pdf',
          collapsed: true,
          items: [
            { text: 'PdfViewer — showcase & API', link: '/components/pdf' },
            { text: 'Usage examples', link: '/components/pdf-usage' },
            { text: 'PDF libraries comparison', link: '/components/pdf-comparison' },
            { text: 'PdfViewer — live demo', link: '/components/pdf-demo' },
          ],
        },
        {
          text: '@rozie-ui/rete',
          collapsed: true,
          items: [
            { text: 'FlowCanvas — showcase & API', link: '/components/rete' },
            { text: 'Usage examples', link: '/components/rete-usage' },
            { text: 'Node-flow editor comparison', link: '/components/rete-comparison' },
            { text: 'FlowCanvas — live demo', link: '/components/rete-demo' },
          ],
        },
        {
          text: '@rozie-ui/embla',
          collapsed: true,
          items: [
            { text: 'Embla — showcase & API', link: '/components/embla' },
            { text: 'Usage examples', link: '/components/embla-usage' },
            { text: 'Embla libraries comparison', link: '/components/embla-comparison' },
            { text: 'Embla — live demo', link: '/components/embla-demo' },
          ],
        },
        {
          text: '@rozie-ui/listbox',
          collapsed: true,
          items: [
            { text: 'Listbox — headless select / combobox', link: '/components/listbox' },
            { text: 'Usage examples', link: '/components/listbox-usage' },
            { text: 'Headless select / combobox comparison', link: '/components/listbox-comparison' },
            { text: 'Listbox — live demo', link: '/components/listbox-demo' },
          ],
        },
        {
          text: '@rozie-ui/slider',
          collapsed: true,
          items: [
            { text: 'Slider — headless slider / range', link: '/components/slider' },
            { text: 'Usage examples', link: '/components/slider-usage' },
            { text: 'Headless slider / range comparison', link: '/components/slider-comparison' },
            { text: 'Slider — live demo', link: '/components/slider-demo' },
          ],
        },
        {
          text: '@rozie-ui/otp',
          collapsed: true,
          items: [
            { text: 'Otp — headless one-time-code input', link: '/components/otp' },
            { text: 'Usage examples', link: '/components/otp-usage' },
            { text: 'Headless one-time-code input comparison', link: '/components/otp-comparison' },
            { text: 'Otp — live demo', link: '/components/otp-demo' },
          ],
        },
        {
          text: '@rozie-ui/toast',
          collapsed: true,
          items: [
            { text: 'Toaster — headless toast / notification host', link: '/components/toast' },
            { text: 'Usage examples', link: '/components/toast-usage' },
            { text: 'Headless toast / notification comparison', link: '/components/toast-comparison' },
            { text: 'Toaster — live demo', link: '/components/toast-demo' },
          ],
        },
        {
          text: '@rozie-ui/combobox',
          collapsed: true,
          items: [
            { text: 'Combobox — headless combobox / autocomplete', link: '/components/combobox' },
            { text: 'Usage examples', link: '/components/combobox-usage' },
            { text: 'Headless combobox / autocomplete comparison', link: '/components/combobox-comparison' },
            { text: 'Combobox — live demo', link: '/components/combobox-demo' },
          ],
        },
        {
          text: '@rozie-ui/dialog',
          collapsed: true,
          items: [
            { text: 'Dialog — headless modal dialog', link: '/components/dialog' },
            { text: 'Usage examples', link: '/components/dialog-usage' },
            { text: 'Headless modal dialog comparison', link: '/components/dialog-comparison' },
            { text: 'Dialog — live demo', link: '/components/dialog-demo' },
          ],
        },
        {
          text: '@rozie-ui/data-table',
          collapsed: true,
          items: [
            { text: 'Overview & install', link: '/components/data-table' },
            { text: 'Quick start', link: '/components/data-table-quick-start' },
            { text: 'Columns', link: '/components/data-table-columns' },
            { text: 'Sort, filter & paginate', link: '/components/data-table-sort-filter-paginate' },
            { text: 'Faceted filtering', link: '/components/data-table-faceted-filtering' },
            { text: 'Row selection', link: '/components/data-table-selection' },
            { text: 'Expandable rows & master-detail', link: '/components/data-table-expandable' },
            { text: 'Grouping & aggregation', link: '/components/data-table-grouping' },
            { text: 'Virtualization', link: '/components/data-table-virtualization' },
            { text: 'Editing', link: '/components/data-table-editing' },
            { text: 'Grid mode & keyboard', link: '/components/data-table-grid-mode' },
            { text: 'API reference', link: '/components/data-table-api' },
            { text: 'Theming', link: '/components/data-table-theming' },
            { text: 'Comparison', link: '/components/data-table-comparison' },
            { text: 'Per-framework usage code', link: '/components/data-table-usage' },
            { text: 'Live demo', link: '/components/data-table-demo' },
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
