import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Rozie.js',
  description:
    'Write components once in a Vue/Alpine-flavored syntax. Ship idiomatic React, Vue, Svelte, and Angular.',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/why' },
      { text: 'Examples', link: '/examples/counter' },
      { text: 'GitHub', link: 'https://github.com/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Why Rozie?', link: '/guide/why' },
            { text: 'Install', link: '/guide/install' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Counter', link: '/examples/counter' },
            { text: 'SearchInput', link: '/examples/search-input' },
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
