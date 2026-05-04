/**
 * Plan 04-06 cleanup — drift-detection between fixtures/*.tsx.snap (the
 * canonical emitter output) and tests/integration/*.compiled.tsx (the
 * hand-tuned React modules used by behavior tests like
 * counter-controllable, modal-strictmode, dropdown-stale-closure,
 * strictmode-all).
 *
 * Why hand-tuned and not regenerated:
 *   The .compiled.tsx variants intentionally diverge from the .snap output
 *   in three documented ways:
 *
 *     1. CSS-module imports → Proxy<string> shim. The behavior tests run
 *        under happy-dom/vitest with no CSS-module loader, so the
 *        `import styles from './X.module.css'` line in the snap can't be
 *        executed; .compiled.tsx replaces it with a Proxy that returns the
 *        key as the class string.
 *     2. Test-only data-testid attributes (e.g. Modal's backdrop testid).
 *     3. Behavioral hand-corrections that work around bugs the emitter
 *        currently produces (e.g. Modal's lockScroll effect needs an
 *        `if (!open) return` guard and `if (!open) return null` early exit
 *        — these will be folded back into the emitter in a later phase).
 *
 *   Auto-regenerating .compiled.tsx from .snap would silently undo (3) and
 *   break the StrictMode tests. Auto-running esbuild over the snap inside
 *   vitest is feasible but adds a heavy globalSetup pass + dynamic-import
 *   plumbing for marginal benefit.
 *
 * What this test catches:
 *   When a .snap changes substantively (component name, props interface
 *   shape, runtime helper imports), the matching .compiled.tsx must be
 *   reviewed. A failure here is a "go look at the diff" prompt, not a
 *   "fix the test" auto-pilot signal.
 *
 * What this test does NOT catch:
 *   - JSX structural drift (the (3) case — by design)
 *   - Effect dep-array changes
 *   - Import re-ordering
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures');
const INTEGRATION = resolve(__dirname, '../../tests/integration');

interface ParsedSurface {
  componentName: string | null;
  propsInterfaceName: string | null;
  propsFields: string[]; // ordered field names (declaration order)
  runtimeImports: string[]; // named imports from @rozie/runtime-react
}

function parseSurface(src: string): ParsedSurface {
  const componentMatch = src.match(/export\s+default\s+function\s+(\w+)\s*\(/);
  const propsInterfaceMatch = src.match(/interface\s+(\w*Props)\s*\{([\s\S]*?)\n\}/);
  const propsFields: string[] = [];
  if (propsInterfaceMatch) {
    const body = propsInterfaceMatch[2] ?? '';
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//')) continue;
      // field name = identifier before `?:` or `:`
      const fieldMatch = line.match(/^(\w+)\s*\??\s*:/);
      if (fieldMatch && fieldMatch[1]) propsFields.push(fieldMatch[1]);
    }
  }
  const runtimeImports: string[] = [];
  const runtimeImportMatch = src.match(/import\s*\{([^}]+)\}\s*from\s*['"]@rozie\/runtime-react['"]/);
  if (runtimeImportMatch) {
    for (const piece of (runtimeImportMatch[1] ?? '').split(',')) {
      const name = piece.trim();
      if (name) runtimeImports.push(name);
    }
  }
  return {
    componentName: componentMatch?.[1] ?? null,
    propsInterfaceName: propsInterfaceMatch?.[1] ?? null,
    propsFields,
    runtimeImports: runtimeImports.sort(),
  };
}

// Map snap basename → compiled.tsx basename (only for components used by
// behavior tests; SearchInput / TodoList are snapshot-only).
const PAIRS: Array<{ snap: string; compiled: string }> = [
  { snap: 'Counter.tsx.snap', compiled: 'Counter.compiled.tsx' },
  { snap: 'Dropdown.tsx.snap', compiled: 'Dropdown.compiled.tsx' },
  { snap: 'Modal.tsx.snap', compiled: 'Modal.compiled.tsx' },
];

describe('compiled-fixtures-drift — .snap vs .compiled.tsx surface check', () => {
  for (const { snap, compiled } of PAIRS) {
    const snapPath = resolve(FIXTURES, snap);
    const compiledPath = resolve(INTEGRATION, compiled);
    if (!existsSync(snapPath) || !existsSync(compiledPath)) {
      it.skip(`${snap} ↔ ${compiled} (file missing)`, () => {});
      continue;
    }
    const snapSrc = readFileSync(snapPath, 'utf8');
    const compiledSrc = readFileSync(compiledPath, 'utf8');
    const snapSurface = parseSurface(snapSrc);
    const compiledSurface = parseSurface(compiledSrc);

    it(`${snap} ↔ ${compiled}: same component name`, () => {
      expect(compiledSurface.componentName).toBe(snapSurface.componentName);
    });
    it(`${snap} ↔ ${compiled}: same props interface name`, () => {
      expect(compiledSurface.propsInterfaceName).toBe(snapSurface.propsInterfaceName);
    });
    it(`${snap} ↔ ${compiled}: same props fields (set equality)`, () => {
      expect(new Set(compiledSurface.propsFields)).toEqual(new Set(snapSurface.propsFields));
    });
    it(`${snap} ↔ ${compiled}: same @rozie/runtime-react named imports`, () => {
      expect(compiledSurface.runtimeImports).toEqual(snapSurface.runtimeImports);
    });
  }
});
