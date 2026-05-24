# Rozie + Next.js Smoke Demo

Proves the [adopt-incrementally guide § Next.js](../../../docs/guide/adopt-incrementally.md) walkthrough works end-to-end on a real Next.js 15 App Router project.

## Shape

Mirrors what `npx create-next-app@latest --typescript --app` produces, plus the documented Rozie wiring:

- `next.config.js` — drops the Rozie unplugin into Next's Webpack config
- `app/Counter.rozie` — a minimal `.rozie` component
- `app/page.tsx` — imports the `.rozie` file with `'use client'`
- `tests/build.test.ts` — runs `next build`, asserts the produced bundle contains compiled Rozie markers

## Run

```bash
pnpm install
pnpm build       # next build
pnpm test:smoke  # build smoke (vitest re-runs next build + asserts on output)
```

The script is `test:smoke` (not `test`) so the everything-test pre-push gate (`turbo run test`) doesn't trigger this heavy build in parallel with the rest of the suite — `next build` is CPU-heavy and would starve other tests. The CI workflow at `.github/workflows/adoption-smokes.yml` runs it on its own runner.

## What the smoke proves

If `next build` succeeds and the produced bundle contains Rozie's stable compile-time markers (`data-rozie-s-<hash>` scope attribute, Rozie runtime imports), then a real `npx create-next-app` user following the docs walkthrough will get a working integration.

## Turbopack

Turbopack doesn't accept arbitrary Webpack plugins as of Next 15. For Turbopack-based pipelines, pre-compile via the Rozie CLI (`pnpm rozie build … --target react --out …`) and import the emitted `.tsx`. This demo uses the Webpack path.
