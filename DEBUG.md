# Debugging cookbook

Running tab of one-liners and helper scripts that have actually been useful
while chasing bugs. Add new entries when you find something non-obvious —
"how would I rediscover this from scratch?" is the bar.

---

## Visual-regression matrix

### Dump every (example × target) screenshot to a temp dir

After a vr build runs, capture each cell to `/tmp/rozie-vr-screens/<target>/<Example>.png`
so you can flip through what each framework actually renders:

```sh
cd tests/visual-regression
pnpm build                                   # builds dist/<target>/ for all 6 targets
pnpm exec vite preview --config vite.preview.config.ts &   # serves dist/ on :4180
node scripts/dump-screenshots.mjs            # writes to /tmp/rozie-vr-screens/
# override output dir:
node scripts/dump-screenshots.mjs --out=/tmp/some-dir
# or ROZIE_VR_OUT=/tmp/some-dir node scripts/dump-screenshots.mjs
```

The script uses the same viewport + `deviceScaleFactor: 1` as the playwright
matrix so output is comparable to `__screenshots__/<Example>.png`. Targets
whose sub-build failed (e.g. Angular when the analogjs upstream is broken)
will time out the `page.goto` and skip — the script still exits 0 after
reporting how many cells failed.

### Run just one target's matrix cells

```sh
cd tests/visual-regression
pnpm exec playwright test --grep "· solid"   # or "· react", "· vue", etc.
```

### Look at the failed-cell artifacts after a matrix run

```sh
for d in tests/visual-regression/test-results/matrix-*-chromium; do
  example=$(basename "$d" | sed 's/^matrix-//; s/-·-.*$//')
  err=$(grep -oE "Expected an image[^.]*\." "$d/error-context.md" 2>/dev/null | head -1)
  echo "$(basename "$d"): $err"
done
```

`Card-actual.png`, `Card-expected.png`, `Card-diff.png` live in each per-cell
folder under `test-results/`.

### Inspect what a single cell renders in headless chrome

When a vr test prints `received 1px by 1px` you want to know why the mount is
empty — page errors are the usual story.

```js
// /tmp/inspect-vr-cell.mjs — must live INSIDE tests/visual-regression/ so
// @playwright/test resolves
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => console.log(`[${m.type()}]`, m.text()));
await page.goto('http://localhost:4180/?example=Counter&target=solid', { waitUntil: 'networkidle' });
console.log(await page.evaluate(() => {
  const el = document.querySelector('[data-testid="rozie-mount"]');
  return { html: el?.outerHTML, rect: el?.getBoundingClientRect() };
}));
await browser.close();
```

---

## Tracing module resolution

### Watch which conditions Vite uses for a package

```sh
NODE_DEBUG=module pnpm exec vite build 2>&1 \
  | grep -E 'looking for "solid-js/web"' | head -3
```

The full search-path list is printed; you can tell whether `.pnpm/node_modules`
is in the chain and which version got matched.

### Trace what a Rozie plugin resolveId hook is doing

Drop a one-shot debug plugin into the consumer's `vite.config.ts`:

```ts
{
  name: 'debug-resolve',
  enforce: 'post',
  async resolveId(source, importer) {
    if (source.startsWith('solid-js') || source === 'lit') {
      const r = await this.resolve(source, importer, { skipSelf: true });
      console.error('[debug-resolve]', source, '->', r?.id);
    }
    return null;
  },
}
```

Don't forget to delete it before committing.

### Check whether a package is resolvable from a specific location

```sh
node -e "
const { createRequire } = require('node:module');
const r = createRequire('/abs/path/to/parent-module.cjs');
console.log(r.resolve.paths('vite-plugin-solid'));
try { console.log('OK', r.resolve('vite-plugin-solid')); }
catch (e) { console.log('NF:', e.message.split(String.fromCharCode(10))[0]); }
"
```

`r.resolve.paths(pkg)` prints the upward-walk Node would do. Useful when
something like `assertSolidPeerDeps` is failing in a monorepo subtree but
working from the package root.

---

## Comparing target emitter output

Each target has locked fixtures at `packages/targets/<target>/src/__tests__/fixtures/<Example>.snap.{tsx,vue,svelte,ts}`.
Eyeballing them side-by-side is the fastest way to see "why does it work in
Modal but not Card" style bugs:

```sh
diff -u packages/targets/solid/src/__tests__/fixtures/Modal.snap.tsx \
        packages/targets/solid/src/__tests__/fixtures/CardHeader.snap.tsx \
  | less
```

To regenerate after an emitter change:

```sh
pnpm --filter @rozie/target-solid test -- -u   # vitest update mode
```

---

## Build / typecheck across the monorepo

```sh
turbo run build --filter=@rozie/target-solid... # ... = include downstream
turbo run typecheck --force --continue          # honors deps; --continue surfaces all
```

Memory: `pnpm -r typecheck` skips `^build` and floods phantom errors. Use
`turbo run typecheck` instead.

---

## CI legs locally with `act`

```sh
act -W .github/workflows/visual-regression.yml --reuse
act -W .github/workflows/angular-matrix.yml --reuse
```

`--reuse` keeps the container warm between runs. Image is arm64-native on the
machine that runs this.
