import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import PublishedTargetsNotice from './components/PublishedTargetsNotice.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Global so every `docs/components/*.md` page can drop in
    // `<PublishedTargetsNotice />` (or with explicit props) with no per-page
    // import — see the component's doc comment for the partial-debut
    // convention it renders.
    app.component('PublishedTargetsNotice', PublishedTargetsNotice);
  },
} satisfies Theme;
