# Theming

Every value the component renders is a `--rozie-data-table-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. The public `--rozie-data-table-*` tokens are wired by `themes/base.css` onto the short internal `--rdt-*` tokens the component's scoped `<style>` actually reads — so the table renders zero-config without any theme import, and a theme swap re-skins it without touching structure. Override tokens at any ancestor scope:

```css
.rozie-data-table {
  --rozie-data-table-header-bg: #f8fafc;
  --rozie-data-table-border: 1px solid #e2e8f0;
  --rozie-data-table-selection-accent: #6366f1;
  --rozie-data-table-sort-indicator-opacity: 0.8;
}
```

## Design-system bridges

Each package ships token presets that map the data-table tokens onto a known design system's published CSS variables — import `base.css` first, then a bridge:

```ts
import '@rozie-ui/data-table-react/themes/base.css';      // the documented default token set
import '@rozie-ui/data-table-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--ring/--muted…
import '@rozie-ui/data-table-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/data-table-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/data-table/src/themes/base.css). The structural rules (table layout, sticky-header positioning, pinned-column offsets, the resize-handle hit area) are behavior-critical and not consumer-overridable; only the cosmetic values flow through tokens.

## See also

- [Overview & install](/components/data-table) — the package install table and the engine narrative.
- [API reference](/components/data-table-api) — every prop, slice, event, slot, and handle verb.
