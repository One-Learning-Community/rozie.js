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
/**
 * Select's own versions of three spine functions. They are NOT copies and are not
 * derived from the spine's text; each differs like this:
 *
 *  - `isSelected(opt)`: the spine compares `valueOf(opt)` with the model (`===`, or
 *    `includes` for an array). Select's is a lookup in `selection()`, the memoised match
 *    of the model against the options made by src/internal/valueMatch.ts — identity
 *    first, equal object contents only when no option is identical.
 *  - `selectedLabel`: the spine's is a `$computed` that finds the option with `=== cur`
 *    and, for `multiple`, joins the labels of every selected option. Select's is a plain
 *    function (a `$computed` cannot read a `$memo` on React) that reads the first option the
 *    single value matched in `selection()`, and returns '' for `multiple`: the multi
 *    branch has no reader here — the only use is the `selected` slot, which the
 *    template renders under `r-if="!$props.multiple"` (a multi-select shows chips).
 *  - `select(opt)`: the single-select branch is the spine's, line for line. The
 *    multi-select branch decides "already selected" and what to remove from
 *    `selection()` (every model position of the value(s) that select this option)
 *    instead of `arr.includes(v)` / `arr.filter((x) => x !== v)`.
 *
 * What ties them to the spine is SPINE_REWRITTEN_FROM below: the spine's text for the
 * three is pinned, so a change there fails this file until it is looked at.
 */
const REWRITTEN = ['isSelected', 'selectedLabel', 'select'] as const;
/** Host-local in Select: the nine copies, Select's own `visibleOptions`, and the rewritten three. */
const HOST_LOCAL = ['visibleOptions', ...COPIED, ...REWRITTEN];

/**
 * The source text of the WHOLE top-level `const <name> = …` statement: from
 * `const` to the end of its last line. A line ends the statement when every
 * bracket the statement opened is closed again AND the next line is not
 * indented — so an expression-bodied function whose body continues on indented
 * lines (`const f = (a) =>\n  a + 1`) is taken whole, not cut at its first line.
 * Strings, template literals and comments are skipped so a bracket inside them
 * does not count. Comments above the statement are not part of the result.
 */
/**
 * The names imported from listCore.rzts (the name before any `as`). Tolerant of
 * quote style, a trailing semicolon and an import list spread over several lines.
 */
function importedFromSpine(src: string): string[] {
  const re = /^import\s*\{([^}]*)\}\s*from\s*['"]@rozie-ui\/headless-core\/listCore\.rzts['"]\s*;?\s*$/gm;
  return [...src.matchAll(re)].flatMap((m) =>
    m[1]!
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0]!)
      .filter(Boolean),
  );
}

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
    else if (ch === '\n' && depth === 0) {
      // An indented next line continues the statement (top-level statements start in column 0).
      if (next !== ' ' && next !== '\t') break;
    }
    i++;
  }
  return src.slice(start, i);
}

/** Every name in the spine's `export { … }` list. */
function spineExports(): string[] {
  const m = spine.match(/^export \{([^}]*)\}\s*;?\s*$/m);
  if (!m) throw new Error('listCore.rzts has no `export { … }` list');
  return m[1]!.split(',').map((n) => n.trim()).filter(Boolean);
}

/**
 * The exported spine functions that reach `visibleOptions()` — directly, or by
 * calling an exported function that does. These are the ones bound to the spine's
 * own option list, which Select replaces with the grouped visual order.
 */
function reachesVisibleOptions(): string[] {
  const names = spineExports().filter((n) => n !== 'visibleOptions');
  const body = new Map(names.map((n) => [n, statementText(spine, n)] as const));
  const calls = (text: string, fn: string) => new RegExp(`(?<![\\w$.])${fn}\\(`).test(text);
  const reached = new Set(names.filter((n) => calls(body.get(n)!, 'visibleOptions')));
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of names) {
      if (reached.has(n)) continue;
      if ([...reached].some((r) => calls(body.get(n)!, r))) {
        reached.add(n);
        grew = true;
      }
    }
  }
  return names.filter((n) => reached.has(n));
}

/**
 * Spine functions that reach `visibleOptions()` and that Select deliberately does
 * NOT carry, each with the reason. Anything else that reaches it must be in COPIED.
 */
const NOT_NEEDED: Record<string, string> = {
  onInput: 'the filter-input handler — a select-only host has no <input>',
};

/**
 * The spine's text for the three functions Select rewrote (REWRITTEN). They are not
 * verbatim copies, so they cannot be compared with Select's; instead the spine's own
 * text is pinned here. When this fails the spine changed one of them: decide whether
 * the change applies to Select's version in src/Select.rozie (see REWRITTEN for how
 * each differs), port it if so, then update the text.
 */
const SPINE_REWRITTEN_FROM: Record<(typeof REWRITTEN)[number], string> = {
  isSelected: [
    'const isSelected = (opt) => {',
    '  const v = valueOf(opt)',
    '  const cur = $props.value',
    '  if ($props.multiple) return Array.isArray(cur) && cur.includes(v)',
    '  return cur === v',
    '}',
  ].join('\n'),
  selectedLabel: [
    'const selectedLabel = $computed(() => {',
    '  const cur = $props.value',
    '  if ($props.multiple) {',
    '    // Read the model value into a local before narrowing: `$props.value` lowers',
    "    // to a `value()` accessor on Solid, and Array.isArray() can't narrow two",
    '    // separate calls — narrowing one stable local works on every target.',
    '    const arr = Array.isArray(cur) ? cur : []',
    "    if (arr.length === 0) return ''",
    "    return $props.options.filter((o) => arr.includes(valueOf(o))).map(labelOf).join(', ')",
    '  }',
    '  const match = $props.options.find((o) => valueOf(o) === cur)',
    "  return match === undefined ? '' : labelOf(match)",
    '})',
  ].join('\n'),
  select: [
    'const select = (opt) => {',
    '  if (disabledOf(opt)) return',
    '  const v = valueOf(opt)',
    '  if ($props.multiple) {',
    '    const cur = $props.value',
    '    const arr = Array.isArray(cur) ? cur : []',
    '    // Fresh array on every commit — in-place mutation is dropped by the',
    '    // React/Solid/Lit/Angular change detectors.',
    '    const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]',
    '    $model.value = next',
    "    $emit('change', { value: next, option: opt })",
    '  } else {',
    '    $model.value = v',
    "    $emit('change', { value: v, option: opt })",
    '    if ($props.closeOnSelect) { close(); focusControl() }',
    '  }',
    '}',
  ].join('\n'),
};

describe('statementText takes a whole top-level statement', () => {
  const src = [
    '',
    '// a comment above',
    'const one = (a) => a + 1',
    'const block = (a) => {',
    "  if (a === '}') return ')'",
    '  return `${a}{`',
    '}',
    'const multi = (a, b) =>',
    '  a === b ||',
    '  (a !== null && b !== null)',
    '',
    'const chained = (list) => list',
    '  .filter((x) => x)',
    '  .map((x) => [x])',
    '// a comment below',
    'const last = 1',
    '',
  ].join('\n');

  it('a one-line statement ends at its line', () => {
    expect(statementText(src, 'one')).toBe('const one = (a) => a + 1');
  });
  it('a block-bodied function ends at its closing brace; brackets in strings do not count', () => {
    expect(statementText(src, 'block')).toBe(["const block = (a) => {", "  if (a === '}') return ')'", '  return `${a}{`', '}'].join('\n'));
  });
  it('a multi-line expression-bodied function is taken whole, not cut at its first line', () => {
    expect(statementText(src, 'multi')).toBe(['const multi = (a, b) =>', '  a === b ||', '  (a !== null && b !== null)'].join('\n'));
    expect(statementText(src, 'chained')).toBe(['const chained = (list) => list', '  .filter((x) => x)', '  .map((x) => [x])'].join('\n'));
  });
  it('the last statement of the file is read to its end', () => {
    expect(statementText(src + 'const tail = (a) =>\n  a', 'tail')).toBe('const tail = (a) =>\n  a');
  });
});

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
    // …and asks for the highlighted (selected) option to be scrolled into view (non-windowed lists).
    expect(gate).toBe(['const open = () => {', '  if (nativeActive()) return', '  openCore()', '  if (!$props.virtual) scrollActiveIntoView()', '}'].join('\n'));
    // …and nothing else reaches the spine's body directly.
    expect(select.split('openCore()').length - 1).toBe(1);
  });

  it('none of the host-local names is imported from listCore.rzts', () => {
    const imported = importedFromSpine(select);
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.filter((n) => HOST_LOCAL.includes(n))).toEqual([]);
  });

  it('the import scan reads either quote style, an optional semicolon and a multi-line list', () => {
    const one = "import { a, b as c } from '@rozie-ui/headless-core/listCore.rzts'";
    const two = 'import {\n  d,\n  e,\n} from "@rozie-ui/headless-core/listCore.rzts";';
    const other = "import { z } from '@rozie-ui/headless-core/windowing.rzts'";
    expect(importedFromSpine([one, two, other].join('\n'))).toEqual(['a', 'b', 'd', 'e']);
  });

  it('every spine function that reaches visibleOptions() is copied here, or listed as not needed', () => {
    const reaching = reachesVisibleOptions();
    // The scan sees the known ones (a guard against it silently matching nothing).
    expect(reaching).toEqual(expect.arrayContaining(['resolveInitialActive', 'nextEnabled', 'commitActive', 'onTypeahead', 'open', 'move', 'onInput']));
    const unaccounted = reaching.filter((n) => !(COPIED as readonly string[]).includes(n) && !(n in NOT_NEEDED));
    expect(
      unaccounted,
      `listCore.rzts function(s) ${unaccounted.join(', ')} reach visibleOptions(): in Select they would walk the spine's ` +
        'source order, not the grouped visual order. Copy them into Select.rozie and COPIED, or add them to NOT_NEEDED with the reason.',
    ).toEqual([]);
    // …and the two lists hold nothing stale.
    expect((COPIED as readonly string[]).filter((n) => !reaching.includes(n))).toEqual([]);
    expect(Object.keys(NOT_NEEDED).filter((n) => !reaching.includes(n))).toEqual([]);
  });
});

describe("Select's rewritten value-identity functions follow the spine's", () => {
  for (const name of REWRITTEN) {
    it(`${name}: the spine's version is the one Select's was written from`, () => {
      expect(statementText(spine, name)).toBe(SPINE_REWRITTEN_FROM[name]);
      // Select declares its own, exactly once.
      expect(statementText(select, name).startsWith(`const ${name} = `)).toBe(true);
    });
  }

  it("select: the single-select branch is the spine's, line for line", () => {
    const branch = (text: string) => text.slice(text.indexOf('  } else {'));
    expect(branch(SPINE_REWRITTEN_FROM.select)).toContain('$model.value = v');
    expect(branch(statementText(select, 'select'))).toBe(branch(SPINE_REWRITTEN_FROM.select));
  });

  it('selectedLabel is only read where a multi-select never renders it', () => {
    // The multi branch was dropped on the strength of this: every template use sits in
    // the `selected` slot, which is rendered under `r-if="!$props.multiple"`.
    const template = select.slice(select.indexOf('<template>'));
    const lines = template.split('\n').filter((l) => /\bselectedLabel\b/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    const slotOpen = template.split('\n').findIndex((l) => l.includes('name="selected"'));
    const slotClose = template.split('\n').findIndex((l, i) => i > slotOpen && l.includes('</slot>'));
    expect(template.split('\n')[slotOpen]).toContain('r-if="!$props.multiple"');
    const all = template.split('\n');
    all.forEach((l, i) => { if (/\bselectedLabel\b/.test(l)) expect(i >= slotOpen && i <= slotClose, l.trim()).toBe(true); });
  });
});
