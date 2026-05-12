import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Rozie.js',
  description:
    'Write components once in a Vue/Alpine-flavored syntax. Ship idiomatic React, Vue, Svelte, and Angular.',
  base: '/rozie.js/',
  cleanUrls: true,
  lastUpdated: true,
  // QUICKSTART.md predates this site and is linked from the repo root README.
  // Its relative links (../README, ../CLAUDE, ../.planning/ROADMAP, ../packages/…)
  // resolve fine inside the repo but are dead inside the VitePress page set,
  // so exclude it from the site. The new docs/guide/quick-start.md supersedes it.
  srcExclude: ['QUICKSTART.md'],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/why' },
      { text: 'Examples', link: '/examples/counter' },
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
