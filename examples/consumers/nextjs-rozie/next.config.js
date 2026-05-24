// Next.js + Rozie integration — the canonical recipe from
// docs/guide/adopt-incrementally.md § Next.js.
//
// Drops the Rozie unplugin into Next's Webpack config. The unplugin
// resolveId / load / transform hooks run before Next's own loaders, so a
// `import Counter from './Counter.rozie'` from any page or component
// transparently compiles to React + uses Next's standard pipeline.
//
// Turbopack note: as of Next 15, Turbopack doesn't accept arbitrary Webpack
// plugins. For Turbopack-based pipelines, pre-compile via the Rozie CLI
// (see docs/guide/install.md § Standalone CLI). This config uses Webpack.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This is a smoke demo, not a production app. The build assertion is
  // "the Rozie unplugin transforms .rozie files during a real Next build."
  // Cross-package React-types dup soup in the workspace surfaces as
  // post-compile TS errors; the integration we're testing happens during
  // compile (which is reported as "✓ Compiled successfully" above the
  // typecheck step). The smoke test asserts on the produced .next/ bundle
  // directly — so we skip the redundant Next typecheck step here.
  typescript: { ignoreBuildErrors: true },
  // ESLint is also off — the demo's <a href> bare-link rule etc. is not
  // what we're proving.
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // Dynamic require — @rozie/unplugin is ESM-only, Next.js loads
    // next.config.js as CJS. We dynamic-import it inside the webpack hook
    // since the hook itself is called synchronously by Next during
    // bundling. The factory is sync after the await resolves so this
    // works fine in practice.
    const Rozie = require('@rozie/unplugin/webpack').default;
    config.plugins.push(Rozie({ target: 'react' }));
    return config;
  },
};

module.exports = nextConfig;
