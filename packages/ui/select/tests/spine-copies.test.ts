/**
 * spine-copies.test.ts — keeps Select's host-local navigation in sync with the
 * shared list spine.
 *
 * Select needs keyboard navigation and type-ahead to walk the GROUPED (visual)
 * option order. In the spine, those functions are bound to the spine's own
 * `visibleOptions()`, and the script-partial inliner forbids shadowing one
 * declaration of a partial (ROZ139). So Select defines `visibleOptions` itself
 * and carries verbatim copies of the nine spine functions that reach it. This
 * test fails when a copy and the spine drift apart, naming the function.
 *
 * One copy is declared under another name: the spine's `open` is `openCore` in
 * Select (RENAMED below). Select's own `open` is a gate in front of it — it
 * returns early while the native picker is active — and has to carry the
 * public name because `$expose` binds a verb to the script binding of that
 * name. Only the declared name differs; the body is compared byte for byte.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const select = readFileSync(resolve(ROOT, 'src/Select.rozie'), 'utf8');
const spine = readFileSync(resolve(ROOT, '..', 'headless-core/src/listCore.rzts'), 'utf8');

/** The nine functions copied verbatim from the spine. */
const COPIED = [
  'resolveInitialActive',
  'open',
  'toggle',
  'nextEnabled',
  'move',
  'moveEdge',
  'commitActive',
  'onTypeahead',
  'onControlKeyDown',
] as const;
/** Spine name -> the name its copy is declared under in Select, where they differ. */
const RENAMED: Partial<Record<(typeof COPIED)[number], string>> = { open: 'openCore' };
/** Host-local in Select: the nine copies plus Select's own `visibleOptions`. */
const HOST_LOCAL = ['visibleOptions', ...COPIED];

/**
 * The source text of the top-level `const <name> = …` statement: from `const`
 * to the end of the line on which every bracket opened by the statement is
 * closed again. Strings, template literals and comments are skipped so a
 * bracket inside them does not count. Comments above the statement are not
 * part of the result.
 */
function statementText(src: string, name: string): string {
  const head = `\nconst ${name} = `;
  const at = src.indexOf(head);
  if (at === -1) throw new Error(`no top-level \`const ${name} = \` found`);
  if (src.indexOf(head, at + 1) !== -1) throw new Error(`more than one top-level \`const ${name} = \``);
  const start = at + 1;
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const ch = src[i]!;
    const next = src[i + 1];
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i = src.indexOf('*/', i + 2) + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i++;
      while (i < src.length && src[i] !== ch) i += src[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '\n' && depth === 0) break;
    i++;
  }
  return src.slice(start, i);
}

describe('Select host-local navigation is a verbatim copy of the list spine', () => {
  for (const name of COPIED) {
    it(`${name} matches listCore.rzts`, () => {
      const canonical = statementText(spine, name);
      const head = `const ${name} = `;
      expect(canonical.startsWith(head)).toBe(true);
      const localName = RENAMED[name] ?? name;
      // Only the declared name in the declaration head is replaced; the body is untouched.
      const expected = `const ${localName} = ` + canonical.slice(head.length);
      expect(statementText(select, localName)).toBe(expected);
    });
  }

  it('open is a host gate in front of openCore: inert while the native picker is active', () => {
    const gate = statementText(select, 'open');
    expect(gate).toBe(['const open = () => {', '  if (nativeActive()) return', '  openCore()', '}'].join('\n'));
    // …and nothing else reaches the spine's body directly.
    expect(select.split('openCore()').length - 1).toBe(1);
  });

  it('none of the host-local names is imported from listCore.rzts', () => {
    const imports = [...select.matchAll(/^import \{([^}]*)\} from '@rozie-ui\/headless-core\/listCore\.rzts'$/gm)];
    expect(imports.length).toBeGreaterThan(0);
    const imported = imports.flatMap((m) => m[1]!.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!));
    expect(imported.filter((n) => HOST_LOCAL.includes(n))).toEqual([]);
  });
});
