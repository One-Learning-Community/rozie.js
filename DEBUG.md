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

## Analogjs phantom-dependency trap

`@analogjs/vite-plugin-angular@2.5.x` does
`import * as ts from 'typescript'`, `import * as compilerCli from '@angular/compiler-cli'`,
and `import * as ngCompiler from '@angular/compiler'` — none declared as
peer deps. Pnpm resolves each from its flat-hoist slot
(`.pnpm/node_modules/{typescript,@angular/compiler,@angular/compiler-cli}`),
which is a single shared symlink the workspace fights over. With multiple
Angular versions in the tree (vr's Angular 19 + the angular-analogjs demo's
Angular 21), the higher version wins the hoist, mismatches the consumer's
expected Angular major, and crashes during compile.

Our root `package.json` patches all three via `pnpm.packageExtensions`:

```json
{
  "pnpm": {
    "packageExtensions": {
      "@analogjs/vite-plugin-angular": {
        "peerDependencies": {
          "typescript": ">=5.5",
          "@angular/compiler": "^17 || ^18 || ^19 || ^20 || ^21",
          "@angular/compiler-cli": "^17 || ^18 || ^19 || ^20 || ^21"
        }
      }
    }
  }
}
```

After `pnpm install`, each consumer's analogjs gets its OWN
`.pnpm/.../node_modules/{typescript,@angular/compiler,@angular/compiler-cli}`
slot resolved against the consumer's pin. Vr's analogjs sees Angular 19 +
TS 5.6.3 throughout; the angular-analogjs demo's analogjs sees Angular 21 +
TS 5.9.3 throughout. No cross-contamination.

### Inspect what each Angular package actually sees in a consumer's slot

```sh
SLOT=$(readlink tests/visual-regression/node_modules/@analogjs/vite-plugin-angular | sed -E 's|/node_modules/[^/]+/[^/]+$||' | sed 's|^[./]*||')
echo "vr's analogjs slot: node_modules/$SLOT"
echo "  typescript -> $(readlink "node_modules/$SLOT/typescript")"
echo "  @angular/compiler -> $(readlink "node_modules/$SLOT/@angular/compiler")"
echo "  @angular/compiler-cli -> $(readlink "node_modules/$SLOT/@angular/compiler-cli")"
```

Each should point at the version matching the consumer (Angular 19 + TS 5.6
for vr; Angular 21 + TS 5.9 for the angular-analogjs demo).

### Symptom decoder

| Error message | Root cause |
|---|---|
| `ts.createPrinter is not a function` | TS ≤5.4 wrapped its CJS namespace under `default`; analogjs got it via flat hoist. Fixed by adding `typescript` to `packageExtensions` (above). |
| `Cannot read properties of undefined (reading 'kind')` in `isExternalModuleReference` | Two TS versions in the same Node process; cross-version `setExternalModuleIndicator` callback receives a node whose `SyntaxKind` enum values don't match. Fixed by also adding `@angular/compiler` + `@angular/compiler-cli` to `packageExtensions` so each Angular consumer's whole TS+Angular chain is slot-local. |
| `Cannot find package '@angular/compiler' imported from .../@analogjs/...` | Flat-hoist symlink missing; pnpm couldn't satisfy the new peer-dep. Run `pnpm install --force` to regenerate. |
| `JIT compiler unavailable` at runtime in a vr Angular cell | **Not** a topology problem — analogjs's compiled output for components with composition (Card → CardHeader, Modal → Counter, etc.) is falling back to JIT at mount time, and the browser bundle doesn't ship `@angular/compiler`. Separate follow-up; the simple cells (Counter, CardHeader) render fine after the topology fixes. |

### Verifying the packageExtensions patch in a consumer-shaped tree

Visual-regression's workspace coexists Angular 19 (TS 5.6) and Angular 21
(TS 5.9), which is not what a real consumer tree looks like. To verify the
patch works against a single-pin tree:

```sh
cd examples/consumers/angular-analogjs
pnpm exec vite build   # should produce dist/ cleanly
```

That demo uses one Angular major and one TS pin throughout, which is what
real consumers look like.

### Trace which TS files Vite actually loads during a build

When you're chasing a new variant of this class, the fastest signal:

```sh
cd tests/visual-regression
rm -rf node_modules/.vite-temp
ROZIE_TARGET=angular NODE_DEBUG=module pnpm exec vite build --config vite.config.ts 2>&1 \
  | grep -oE "[^ ]*typescript@[0-9.]+/[^/]*/typescript/lib/typescript\.js" | sort -u
```

One entry = healthy. Two = cross-version territory; something is still
phantom-importing through a hoist slot.

---

## Resolved 2026-05-15: vr Angular `JIT compiler unavailable`

Root cause was **NOT** composition — it was that vr's `tsconfig.app.json`
had no `baseUrl` + `paths` mappings. `@analogjs/vite-plugin-angular`'s
NgtscProgram processes `examples/*.rozie.ts` (cross-tree via
`prebuildExtraRoots`), and TypeScript's node-style resolution walks UP
from `examples/` — never reaching vr's sibling `node_modules/`. Unresolved
symbols inside `@Component({ imports: [...] })` caused NgtscProgram to
skip emitting `ɵcmp`; the file fell back to esbuild's legacy
`__decorate(...)` path; at mount Angular tried to JIT-compile against a
`@angular/compiler` that's not in the browser bundle. Counter and
CardHeader had no `imports:` array so nothing for the analyzer to bail
on.

Fix: added `baseUrl: "."` + `paths` for `@angular/*`, `@analogjs/*`,
`zone.js`, `rxjs`, `tslib` to `tests/visual-regression/tsconfig.app.json`.
All 8 cells now emit `ɵcmp` and render. `entry.angular` bundle: 268KB → 184KB.

Full session log: `.planning/debug/vr-angular-jit-composed.md`.

---

## CI legs locally with `act`

```sh
act -W .github/workflows/visual-regression.yml --reuse
act -W .github/workflows/angular-matrix.yml --reuse
```

`--reuse` keeps the container warm between runs. Image is arm64-native on the
machine that runs this.
