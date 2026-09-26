/**
 * Every published `@rozie-ui/*-solid` leaf must build in a consumer app with NO special config.
 *
 * Reported from a Solid dogfooding session: the leaves shipped Solid JSX inside
 * `dist/index.{mjs,cjs}` under plain `import`/`require` conditions. That is not JavaScript, so
 * a default `vite-plugin-solid` app failed with "JSX syntax is disabled" (the plugin only
 * transforms `.[mc]?[jt]sx` files) and every other bundler failed outright. The only way to
 * build was to point vite-plugin-solid at `.mjs` files in node_modules — the workaround our
 * own VR harness carried, which is why no gate here ever saw it.
 *
 * The shape the leaves now ship is the standard Solid-library one:
 *   - `import` / `require` — JavaScript compiled by babel-preset-solid (DOM output), so any
 *     bundler works with no Solid plugin at all;
 *   - `solid` — the JSX source build (`dist/source/index.jsx`), which vite-plugin-solid and
 *     SolidStart resolve FIRST so they can compile it for their own mode (DOM, SSR, hydration).
 *
 * The consumer here imports all of them (src/main.ts) and is built three ways. Engine peers
 * (chart.js, maplibre-gl, …) are externalized: this is about the leaves' own dist, not their
 * engines, and it keeps the fixture free of 29 families' heavy peers.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type InlineConfig, type Rollup } from 'vite';
import solid from 'vite-plugin-solid';
import { parseSync } from 'oxc-parser';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8'));
const LEAVES: string[] = Object.keys(PKG.dependencies).filter((n) => n.startsWith('@rozie-ui/'));

// Bundle the leaves, their Solid runtime and solid-js; leave everything else (engines) external.
const BUNDLED = /^(@rozie-ui\/|@rozie\/runtime-solid|solid-js)/;
const external = (id: string) =>
  !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !BUNDLED.test(id);

function leafDir(name: string): string {
  return realpathSync(join(HERE, 'node_modules', name));
}

async function bundle(extra: InlineConfig): Promise<string> {
  const out = (await build({
    root: HERE,
    configFile: false,
    logLevel: 'silent',
    ...extra,
    build: {
      write: false,
      minify: false,
      ...extra.build,
      rollupOptions: { input: join(HERE, 'src/main.ts'), external, preserveEntrySignatures: 'strict' },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const outputs = Array.isArray(out) ? out : [out];
  return outputs.flatMap((o) => o.output).map((c) => ('code' in c ? c.code : '')).join('\n');
}

describe('published @rozie-ui Solid leaves', () => {
  it('covers every Solid leaf in the repo', () => {
    expect(LEAVES.length).toBeGreaterThanOrEqual(29);
  });

  it.each(LEAVES)('%s ships JavaScript under import/require and JSX under `solid`', (name) => {
    const dir = leafDir(name);
    const exp = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).exports['.'];
    for (const cond of ['import', 'require'] as const) {
      const file = resolve(dir, exp[cond]);
      const { errors } = parseSync(file, readFileSync(file, 'utf8'), { lang: 'js' });
      expect(errors.map((e) => e.message), `${name} ${cond} -> ${exp[cond]}`).toEqual([]);
    }
    expect(exp.solid, `${name} has no "solid" export condition`).toBeTypeOf('string');
    const source = resolve(dir, exp.solid);
    expect(existsSync(source), `${name} solid -> ${exp.solid} missing`).toBe(true);
    expect(parseSync(source, readFileSync(source, 'utf8'), { lang: 'jsx' }).errors).toEqual([]);
  });

  it('imports only solid-js/web helpers that exist at the peer floor (solid-js 1.8.0)', () => {
    // The compiled build calls helpers from `solid-js/web`; the leaves declare `solid-js ^1.8`.
    // babel-preset-solid 1.9 emits `setStyleProperty`, which no 1.8 release exports — a
    // consumer on 1.8 would fail at import. The floor version is installed under an alias.
    const floor = readFileSync(join(HERE, 'node_modules/solid-js-peer-floor/web/dist/web.js'), 'utf8');
    const exported = new Set(
      [...floor.matchAll(/export \{([^}]*)\}/g)].flatMap((m) =>
        m[1].split(',').map((t) => t.trim().split(/\s+as\s+/).pop()!).filter(Boolean),
      ),
    );
    expect(exported.size).toBeGreaterThan(50);
    const missing: string[] = [];
    for (const name of LEAVES) {
      const dir = leafDir(name);
      for (const f of readdirSync(join(dir, 'dist')).filter((n) => /\.(mjs|cjs)$/.test(n))) {
        const code = readFileSync(join(dir, 'dist', f), 'utf8');
        const esm = [...code.matchAll(/import \{([^}]*)\} from "solid-js\/web"/g)].flatMap((m) =>
          m[1].split(',').map((t) => t.trim().split(/\s+as\s+/)[0]).filter(Boolean),
        );
        const cjs = [...code.matchAll(/solid_js_web\.(\w+)/g)].map((m) => m[1]);
        for (const h of new Set([...esm, ...cjs])) if (!exported.has(h)) missing.push(`${name} dist/${f}: ${h}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('builds with a DEFAULT vite-plugin-solid config', async () => {
    const code = await bundle({ plugins: [solid()] });
    expect(code).toMatch(/solid-js\/web|template\(/);
  }, 180_000);

  it('builds with NO Solid plugin at all (the import condition is plain JavaScript)', async () => {
    await expect(bundle({ plugins: [] })).resolves.toBeTypeOf('string');
  }, 180_000);

  it('builds for SSR, compiling the `solid` condition with server output', async () => {
    const code = await bundle({
      plugins: [solid({ ssr: true })],
      build: { ssr: join(HERE, 'src/main.ts') },
      ssr: { noExternal: [BUNDLED] },
    });
    // Server-compiled Solid JSX renders through `ssr` / `ssrElement` / `escape` — DOM
    // `template()` output here would mean the DOM build leaked into the server bundle.
    expect(code).toMatch(/\bssr(Element|Attribute|HydrationKey)?\(|\bescape\(/);
  }, 180_000);
});
