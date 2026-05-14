import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import Rozie from '@rozie/unplugin/vite';

const rozieGrammar = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../tools/textmate/syntaxes/rozie.tmLanguage.json', import.meta.url)),
    'utf8',
  ),
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
  },
  // Dogfood the project: compile .rozie files inline through the unplugin so
  // example pages can embed the *actual* components they document. Rozie
  // emits Vue SFC text; VitePress's bundled vue plugin then takes it the
  // rest of the way.
  vite: {
    plugins: [Rozie({ target: 'vue' })],
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/why' },
      { text: 'Examples', link: '/examples/' },
      { text: 'GitHub', link: 'https://github.com/One-Learning-Community/rozie.js' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Why Rozie?', link: '/guide/why' },
            { text: 'Install', link: '/guide/install' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Features & design choices', link: '/guide/features' },
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
