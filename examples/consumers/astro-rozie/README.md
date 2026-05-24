# Rozie + Astro Smoke Demo

Proves the [adopt-incrementally guide § Astro](../../../docs/guide/adopt-incrementally.md) and [for-astro-and-html-first-shops](../../../docs/guide/for-astro-and-html-first-shops.md) walkthroughs work end-to-end on a real Astro 5 project.

## Shape

Mirrors what `npm create astro@latest` produces, plus the documented Rozie wiring:

- `astro.config.mjs` — drops the Rozie unplugin into Astro's Vite-plugin slot, target `lit`
- `src/components/Counter.rozie` — a minimal `.rozie` component
- `src/pages/index.astro` — imports the `.rozie` file as a side effect (custom-element registration) and uses `<rozie-counter>` directly in HTML
- `tests/build.test.ts` — runs `astro build`, asserts (a) the rendered HTML has the custom-element tag and (b) the JS bundle contains compiled Rozie markers

## Run

```bash
pnpm install
pnpm build        # astro build
pnpm test:smoke   # build smoke (vitest re-runs astro build + asserts on output)
```

The script is `test:smoke` (not `test`) so the everything-test pre-push gate (`turbo run test`) doesn't trigger this build in parallel with the rest of the suite. The CI workflow at `.github/workflows/adoption-smokes.yml` runs it on its own runner.

## What the smoke proves

`target: 'lit'` is the recommended Astro default — Web Components hydrate without an island-bridge runtime (~6KB Lit vs ~45KB React + RDOM). The smoke confirms the documented "import a .rozie file; use the custom-element tag in HTML" path actually produces a working build.
