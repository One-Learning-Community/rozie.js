/**
 * Plan 04-05 Task 2 — D-58 React-branch resolveId + load tests.
 *
 * Tests 3-6 from plan §<behavior>:
 *   3. resolveId target='react' rewrites Foo.rozie → <abs>/Foo.rozie.tsx
 *   4. load target='react' .tsx — happy path returns { code, map }
 *   5. load target='react' ?style=module → CSS body, map: null
 *   6. load target='react' .rozie.module.css sibling → CSS body, map: null
 *      load returns null for .rozie.global.css when no :root rules
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createResolveIdHook,
  createLoadHook,
  transformIncludeRozie,
} from '../transform.js';
import { ModifierRegistry } from '@rozie/core';
import { registerBuiltins } from '../../../core/src/modifiers/registerBuiltins.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function makeRegistry(): ModifierRegistry {
  const r = new ModifierRegistry();
  registerBuiltins(r);
  return r;
}

describe('transformInclude — Plan 04-05 React surface', () => {
  it('matches *.rozie.tsx synthetic ids', () => {
    expect(transformIncludeRozie('Foo.rozie.tsx')).toBe(true);
    expect(transformIncludeRozie('/abs/Counter.rozie.tsx')).toBe(true);
  });

  it('matches *.rozie.module.css and *.rozie.global.css sibling ids', () => {
    expect(transformIncludeRozie('/abs/Counter.rozie.module.css')).toBe(true);
    expect(transformIncludeRozie('/abs/Modal.rozie.global.css')).toBe(true);
  });

  it('matches ?style=module / ?style=global query forms', () => {
    expect(transformIncludeRozie('/abs/Foo.rozie.tsx?style=module')).toBe(true);
    expect(transformIncludeRozie('/abs/Foo.rozie.tsx?style=global')).toBe(true);
  });

  it('does NOT match plain .tsx / .css / .module.css ids (consumer-authored)', () => {
    expect(transformIncludeRozie('App.tsx')).toBe(false);
    expect(transformIncludeRozie('main.module.css')).toBe(false);
    expect(transformIncludeRozie('global.css')).toBe(false);
  });
});

describe('resolveId target="react" — D-58 path-virtual', () => {
  it('rewrites bare .rozie ids to <abs>/Foo.rozie.tsx', () => {
    const resolveHook = createResolveIdHook('react');
    const id = './Counter.rozie';
    const importer = resolve(EXAMPLES, 'foo.ts');
    const out = resolveHook(id, importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.tsx'));
  });

  it('rewrites sibling .module.css to .rozie.module.css when sibling .rozie exists', () => {
    const resolveHook = createResolveIdHook('react');
    // Importer is the synthetic .tsx; the import inside emits `./Counter.module.css`.
    const id = './Counter.module.css';
    const importer = resolve(EXAMPLES, 'Counter.rozie.tsx');
    const out = resolveHook(id, importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.module.css'));
  });

  it('rewrites sibling .global.css to .rozie.global.css when sibling .rozie exists', () => {
    const resolveHook = createResolveIdHook('react');
    const id = './Dropdown.global.css';
    const importer = resolve(EXAMPLES, 'Dropdown.rozie.tsx');
    const out = resolveHook(id, importer);
    expect(out).toBe(resolve(EXAMPLES, 'Dropdown.rozie.global.css'));
  });

  it('returns null for plain .module.css / .global.css when no sibling .rozie exists', () => {
    const resolveHook = createResolveIdHook('react');
    // /tmp/no-rozie-here.module.css has no sibling .rozie.
    expect(resolveHook('./no-rozie-here.module.css', '/tmp/main.tsx')).toBeNull();
    expect(resolveHook('./other.global.css', '/tmp/main.tsx')).toBeNull();
  });

  it('passes through synthetic .rozie.tsx / .rozie.module.css ids', () => {
    const resolveHook = createResolveIdHook('react');
    expect(resolveHook('/abs/Foo.rozie.tsx', undefined)).toBe('/abs/Foo.rozie.tsx');
    expect(resolveHook('/abs/Foo.rozie.module.css', undefined)).toBe('/abs/Foo.rozie.module.css');
  });

  it('returns null for non-.rozie ids', () => {
    const resolveHook = createResolveIdHook('react');
    expect(resolveHook('react', undefined)).toBeNull();
    expect(resolveHook('./App.tsx', '/abs/main.tsx')).toBeNull();
  });

  // Phase 06.2 D-118 cross-rozie composition: React emitter rewrites
  // `<components>{ Foo }</components>` to `import Foo from './Foo'`
  // (extensionless — `rewriteRozieImport` returns ''). Vite's normal
  // resolver tries `.tsx`/`.ts`/`.jsx`/`.js`, finds nothing on disk because
  // the source is `Foo.rozie`, then falls through to plugin chain. Our
  // resolveId must rewrite to the synthetic `Foo.rozie.tsx`.
  it('rewrites ./Foo (extensionless) → <abs>/Foo.rozie.tsx when sibling Foo.rozie exists', () => {
    const resolveHook = createResolveIdHook('react');
    const importer = resolve(EXAMPLES, 'Modal.rozie.tsx');
    const out = resolveHook('./Counter', importer);
    expect(out).toBe(resolve(EXAMPLES, 'Counter.rozie.tsx'));
  });

  it('does NOT rewrite extensionless imports when no sibling .rozie exists', () => {
    const resolveHook = createResolveIdHook('react');
    expect(resolveHook('./SomeRandomLocalModule', '/tmp/main.tsx')).toBeNull();
  });

  it('does NOT rewrite bare module specifiers (e.g. `react`, `lodash/get`)', () => {
    const resolveHook = createResolveIdHook('react');
    // Bare specifiers without a leading ./ or ../ must not trigger the
    // sibling-rozie rewrite — only relative/absolute paths can.
    expect(resolveHook('react', '/tmp/main.tsx')).toBeNull();
    expect(resolveHook('lodash/get', '/tmp/main.tsx')).toBeNull();
  });
});

describe('load target="react" — happy path + style routing', () => {
  const ctx = { warn: vi.fn(), error: vi.fn() };

  it('loads Counter.rozie.tsx → returns React .tsx code with CSS imports', () => {
    const loadHook = createLoadHook(makeRegistry(), 'react');
    const id = resolve(EXAMPLES, 'Counter.rozie.tsx');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(typeof code).toBe('string');
    // D-67: emitReact emits `export default function Counter`.
    expect(code).toContain('export default function Counter');
    // Plan 04-05: CSS Module sibling import at top.
    expect(code).toContain("import styles from './Counter.module.css';");
    // D-68: NEVER imports React default.
    expect(code).not.toMatch(/import React from ['"]react['"]/);
    // Source map points back at the .rozie file.
    expect(map).toBeDefined();
    expect(map.sources[0]).toMatch(/Counter\.rozie$/);
  });

  it('loads Counter.rozie.module.css → returns scoped CSS body, map=null', () => {
    const loadHook = createLoadHook(makeRegistry(), 'react');
    const id = resolve(EXAMPLES, 'Counter.rozie.module.css');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(typeof code).toBe('string');
    expect(code).toContain('.counter');
    expect(code).not.toContain(':root');
    expect(map).toBeNull();
  });

  it('loads Dropdown.rozie.global.css → returns :root CSS body', () => {
    const loadHook = createLoadHook(makeRegistry(), 'react');
    const id = resolve(EXAMPLES, 'Dropdown.rozie.global.css');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(code).toContain(':root');
    expect(code).toContain('--rozie-dropdown-z');
    expect(map).toBeNull();
  });

  it('returns null for Counter.rozie.global.css (no :root rules in Counter)', () => {
    const loadHook = createLoadHook(makeRegistry(), 'react');
    const id = resolve(EXAMPLES, 'Counter.rozie.global.css');
    const result = loadHook.call(ctx as any, id);
    expect(result).toBeNull();
  });

  it('handles ?style=module query suffix (Path 1 fallback)', () => {
    const loadHook = createLoadHook(makeRegistry(), 'react');
    const id = resolve(EXAMPLES, 'Counter.rozie.tsx?style=module');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code, map } = result as { code: string; map: any };
    expect(code).toContain('.counter');
    expect(map).toBeNull();
  });

  it('handles ?style=global query suffix returning null when no :root', () => {
    const loadHook = createLoadHook(makeRegistry(), 'react');
    const id = resolve(EXAMPLES, 'Counter.rozie.tsx?style=global');
    const result = loadHook.call(ctx as any, id);
    expect(result).toBeNull();
  });

  it('returns null for non-react virtual ids', () => {
    const loadHook = createLoadHook(makeRegistry(), 'react');
    expect(loadHook.call(ctx as any, '/regular/foo.ts')).toBeNull();
    expect(loadHook.call(ctx as any, '/regular/bar.vue')).toBeNull();
  });
});

describe('Vue branch unchanged (Phase 3 regression check)', () => {
  it('Vue resolveId still rewrites .rozie → .rozie.vue', () => {
    const resolveHook = createResolveIdHook('vue');
    const id = './Counter.rozie';
    const importer = resolve(EXAMPLES, 'foo.ts');
    expect(resolveHook(id, importer)).toBe(resolve(EXAMPLES, 'Counter.rozie.vue'));
  });

  it('Vue load still produces .vue source for synthetic ids', () => {
    const loadHook = createLoadHook(makeRegistry(), 'vue');
    const ctx = { warn: vi.fn() };
    const id = resolve(EXAMPLES, 'Counter.rozie.vue');
    const result = loadHook.call(ctx as any, id);
    expect(result).not.toBeNull();
    const { code } = result as { code: string };
    expect(code.startsWith('<template>')).toBe(true);
  });
});
