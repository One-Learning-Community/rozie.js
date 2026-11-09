/**
 * ANGULAR-SORTABLE-LIST-README-USAGE — the Angular README's quick start and
 * forms example compile with `ngc` (strictTemplates) against
 * compile(SortableList.rozie): every `[input]`, `(output)` and forms
 * directive in the template must exist and type-check on the real component.
 * strictTemplates does not check an `<ng-template #ref>` name (an unknown ref
 * is just an unused template), so each ref is also checked against the
 * component's `@ContentChild` queries.
 *
 * The snippets are read from the rendered leaf README (what npm shows), with
 * the package import pointed at the compiled component. Only consumer.ts's
 * errors count. Negatives prove the gate catches a wrong output, a wrong
 * input and a wrong template ref.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PKG = resolve(ROOT, 'packages/ui/sortable-list');
const LEAF = resolve(PKG, 'packages/angular');
const SRC = readFileSync(resolve(PKG, 'src/SortableList.rozie'), 'utf8');
const INTERNALS = ['useSortableJS.ts', 'keyboardRegistry.ts', 'announcements.ts'];

const COMPONENT = (() => {
  const r = compile(SRC, { target: 'angular', filename: 'SortableList.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.code.replaceAll("'./internal/", "'./");
})();

/** The README's code blocks under a heading (first block). */
function snippet(heading: string): string {
  const md = readFileSync(resolve(LEAF, 'README.md'), 'utf8');
  const at = md.indexOf(`\n## ${heading}\n`);
  expect(at, heading).toBeGreaterThan(-1);
  const m = md.slice(at).match(/```ts\n([\s\S]*?)\n```/);
  expect(m).toBeTruthy();
  return m![1]!.replaceAll(`'@rozie-ui/sortable-list-angular'`, `'./SortableList'`);
}

/** ngc (strictTemplates) errors reported in consumer.ts. */
function consumerErrors(consumer: string): string[] {
  const ngc = join(LEAF, 'node_modules/.bin/ngc');
  if (!existsSync(ngc)) throw new Error(`ngc not found at ${ngc} — install/build the workspace first.`);
  const dir = mkdtempSync(join(tmpdir(), 'rozie-angular-sortable-readme-'));
  try {
    writeFileSync(join(dir, 'SortableList.ts'), COMPONENT);
    for (const f of INTERNALS) writeFileSync(join(dir, f), readFileSync(resolve(PKG, 'src/internal', f), 'utf8'));
    writeFileSync(join(dir, 'consumer.ts'), consumer);
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          noEmit: true,
          target: 'ES2022',
          module: 'ES2022',
          moduleResolution: 'bundler',
          strict: true,
          experimentalDecorators: true,
          useDefineForClassFields: false,
          esModuleInterop: true,
          skipLibCheck: true,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        },
        angularCompilerOptions: { strictTemplates: true, strictInputAccessModifiers: true, strictNullInputTypes: true },
        include: ['*.ts'],
      }),
    );
    copyFileSync(join(HERE, 'engine-modules.d.ts'), join(dir, 'engine-modules.d.ts'));
    symlinkSync(join(LEAF, 'node_modules'), join(dir, 'node_modules'), 'dir');
    let out = '';
    try {
      execFileSync(ngc, ['-p', 'tsconfig.json'], { cwd: dir, stdio: 'pipe' });
    } catch (err) {
      out = (((err as { stdout?: Buffer }).stdout?.toString() ?? '') + ((err as { stderr?: Buffer }).stderr?.toString() ?? '')).replace(/\x1b\[[0-9;]*m/g, '');
    }
    return out.split('\n').filter((l) => /consumer\.ts:\d+:\d+ - error/.test(l));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CONTENT_REFS = [...COMPONENT.matchAll(/@ContentChild\('(\w+)'/g)].map((m) => m[1]);
const refsOf = (code: string) => [...code.matchAll(/<ng-template #(\w+)/g)].map((m) => m[1]);

describe('ANGULAR-SORTABLE-LIST-README-USAGE — the README snippets compile against the component', () => {
  for (const heading of ['Usage', 'Angular forms']) {
    it(`${heading}: ngc strictTemplates is clean and every template ref is a content query`, () => {
      const code = snippet(heading);
      expect(refsOf(code).length).toBeGreaterThan(0);
      for (const r of refsOf(code)) expect(CONTENT_REFS).toContain(r);
      expect(consumerErrors(code)).toEqual([]);
    });
  }

  it('negative: an unknown output fails', () => {
    // An unknown output binds as a native DOM event, so `$event` is an
    // `Event` and `items = $event` no longer type-checks.
    const errs = consumerErrors(snippet('Usage').replace('(itemsChange)=', '(itemsChnge)='));
    expect(errs.join('\n')).toMatch(/TS2740: Type 'Event' is missing/);
  });

  it('negative: an unknown input fails', () => {
    const errs = consumerErrors(snippet('Usage').replace('[items]=', '[itms]='));
    expect(errs.join('\n')).toMatch(/NG8002|itms/);
  });

  it('negative: the old `#default` ref is not a content query', () => {
    expect(CONTENT_REFS).not.toContain('default');
  });
});
