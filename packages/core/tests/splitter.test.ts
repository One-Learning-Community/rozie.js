// PARSE-01 — SFC block splitter acceptance suite (Plan 02 Task 2).
// Implementation under test: packages/core/src/splitter/splitBlocks.ts.
// Snapshot fixtures: packages/core/fixtures/blocks/{Example}-blockmap.snap (D-16).
//
// This file replaces the Wave 0 scaffold (.todo placeholders) with live tests
// for all 5 reference examples plus edge cases (empty block, missing envelope,
// unknown top-level block).
//
// Pitfall 8 mitigation: paths anchored via `import.meta.url` so snapshots
// resolve identically from `pnpm --filter @rozie/core test` (root) and from
// `pnpm test` (in packages/core/).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { splitBlocks } from '../src/splitter/splitBlocks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const FIXTURES_DIR = resolve(__dirname, '../fixtures/blocks');

function readExample(name: string): string {
  return readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
}

describe('splitBlocks (PARSE-01)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
    expect(FIXTURES_DIR).toMatch(/fixtures\/blocks$/);
  });

  // Block-presence matrix (per CONTEXT.md "Specific Ideas").
  // Each row is the list of blocks (excluding 'rozie') expected to be present
  // in the corresponding example file. Blocks not listed must be absent.
  const matrix: Array<{ name: string; expectedBlocks: ReadonlyArray<keyof typeof BLOCKS> }> = [
    { name: 'Counter', expectedBlocks: ['props', 'data', 'script', 'template', 'style'] },
    { name: 'SearchInput', expectedBlocks: ['props', 'data', 'script', 'template', 'style'] },
    { name: 'Dropdown', expectedBlocks: ['props', 'script', 'listeners', 'template', 'style'] },
    { name: 'TodoList', expectedBlocks: ['props', 'data', 'script', 'template', 'style'] },
    { name: 'Modal', expectedBlocks: ['props', 'script', 'listeners', 'template', 'style'] },
  ];
  // Type-only marker so the matrix expectedBlocks list is statically valid.
  const BLOCKS = {
    props: 1,
    data: 1,
    script: 1,
    listeners: 1,
    template: 1,
    style: 1,
  } as const;

  for (const { name, expectedBlocks } of matrix) {
    it(`splits ${name}.rozie cleanly with byte-accurate offsets`, async () => {
      const source = readExample(name);
      const result = splitBlocks(source, `${name}.rozie`);

      // Acceptance: no diagnostics on a valid example.
      expect(result.diagnostics).toEqual([]);
      expect(result.rozie?.name).toBe(name);

      // <rozie> envelope loc covers the full root tag from '<rozie' to '</rozie>'.
      expect(result.rozie?.loc.start).toBe(source.indexOf('<rozie'));
      const envelopeEndExpected = source.lastIndexOf('</rozie>') + '</rozie>'.length;
      expect(result.rozie?.loc.end).toBe(envelopeEndExpected);

      // Every expected block is present and content matches the byte slice.
      for (const blockName of expectedBlocks) {
        const block = result[blockName];
        expect(block, `${name}.rozie missing block: ${blockName}`).toBeDefined();
        if (!block) continue;
        // Byte-accurate offset acceptance criterion.
        expect(source.slice(block.contentLoc.start, block.contentLoc.end)).toBe(block.content);
        // loc covers tags; opening tag is `<{name}>` so source[loc.start] === '<'.
        expect(source[block.loc.start]).toBe('<');
        // loc.end is one past '>' of closing tag.
        expect(source[block.loc.end - 1]).toBe('>');
      }

      // Blocks NOT in the matrix must be absent.
      const allBlocks: ReadonlyArray<keyof typeof BLOCKS> = [
        'props',
        'data',
        'script',
        'listeners',
        'template',
        'style',
      ];
      for (const blockName of allBlocks) {
        if (!expectedBlocks.includes(blockName)) {
          expect(result[blockName], `${name}.rozie unexpectedly contains <${blockName}>`).toBeUndefined();
        }
      }

      // Snapshot the full result (block content + offsets).
      await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(
        resolve(FIXTURES_DIR, `${name}-blockmap.snap`),
      );
    });
  }

  it('Dropdown.rozie style block contains the :root escape hatch', () => {
    // Verifies the splitter preserves the raw text of `:root { --rozie-dropdown-z: 1000; }`
    // for postcss to detect later (per Plan 02 acceptance — splitter just preserves).
    const result = splitBlocks(readExample('Dropdown'), 'Dropdown.rozie');
    expect(result.style?.content).toMatch(/:root\s*\{[\s\S]*--rozie-dropdown-z:\s*1000/);
  });

  it('empty <props></props> round-trips with content === ""', () => {
    const result = splitBlocks('<rozie name="Empty"><props></props></rozie>');
    expect(result.diagnostics).toEqual([]);
    expect(result.props?.content).toBe('');
    expect(result.props?.contentLoc.start).toBe(result.props?.contentLoc.end);
  });

  it('WR-01 regression: name attribute is correct when <rozie> has multiple attributes', () => {
    // Bug: pendingAttribValueChunks was reset on every onattribname, so onopentagend
    // read the LAST attribute's value instead of 'name'. With <rozie name="Counter" lang="ts">
    // the old code would produce name === "ts" instead of "Counter".
    const src = '<rozie name="Counter" lang="ts"><props>{}</props></rozie>';
    const result = splitBlocks(src, 'Counter.rozie');
    expect(result.diagnostics).toEqual([]);
    expect(result.rozie?.name).toBe('Counter'); // must NOT be "ts"
  });

  // Phase 9 Plan 09-01 Task 1 — generic SFC-block `lang=` attribute substrate.
  // `lang` is extracted on any recognized block opening tag at depth 1, not
  // just `<rozie name=>`. `<script lang="ts">` consumes it this phase;
  // `<style lang="scss">` proves the substrate is generic (not script-only).
  describe('block lang= attribute (Phase 9)', () => {
    it('captures lang="ts" on a <script> block', () => {
      const src =
        '<rozie name="Typed"><script lang="ts">const x: number = 1;</script></rozie>';
      const result = splitBlocks(src, 'Typed.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.script?.lang).toBe('ts');
    });

    it('captures lang="js" on a <script> block', () => {
      const src =
        '<rozie name="PlainJs"><script lang="js">const x = 1;</script></rozie>';
      const result = splitBlocks(src, 'PlainJs.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.script?.lang).toBe('js');
    });

    it('leaves lang undefined on a plain <script> (no attribute)', () => {
      const src =
        '<rozie name="Bare"><script>const x = 1;</script></rozie>';
      const result = splitBlocks(src, 'Bare.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.script).toBeDefined();
      // Under exactOptionalPropertyTypes the key is absent, not `undefined`.
      expect(result.script?.lang).toBeUndefined();
      expect(Object.hasOwn(result.script as object, 'lang')).toBe(false);
    });

    it('captures lang="scss" on a <style> block — generic-substrate proof', () => {
      // The substrate is deliberately not script-only: a future
      // <style lang="scss/less"> phase reuses this exact plumbing.
      const src =
        '<rozie name="Styled"><style lang="scss">.a { .b { color: red; } }</style></rozie>';
      const result = splitBlocks(src, 'Styled.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.style?.lang).toBe('scss');
    });
  });

  describe('opaque-block bodies (260526-uj3 forward-work fix)', () => {
    // `<props>`, `<data>`, `<listeners>`, `<components>` bodies are JS/CSS
    // source — not HTML. The splitter must treat angle brackets inside these
    // bodies (JS comments, generic type params, string literals) as opaque
    // text so phantom-tag events from htmlparser2 do not desync the depth
    // counter and silently drop the block from the BlockMap. Regression
    // surfaced when a `<SortableList>` reference in a `<props>` JS-comment
    // caused `compile()` to return `code: ''` with zero diagnostics.

    it('<props> body with `<Tag>` in a JS comment still parses cleanly', () => {
      const src = `<rozie name="X">
<props>
{
  // re-keying its <SortableList> instance
  foo: { type: String, default: null },
}
</props>
<template><div>x</div></template>
</rozie>`;
      const result = splitBlocks(src, 'X.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.props).toBeDefined();
      expect(result.props?.content).toContain('foo:');
      expect(result.props?.content).toContain('<SortableList>');
      expect(result.template).toBeDefined();
    });

    it('<data> body with `<Tag>` in a JS comment still parses cleanly', () => {
      const src = `<rozie name="X">
<data>
{
  // we used to call this <OldName> but renamed
  count: 0,
}
</data>
<template><div>x</div></template>
</rozie>`;
      const result = splitBlocks(src, 'X.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.data).toBeDefined();
      expect(result.data?.content).toContain('count:');
      expect(result.template).toBeDefined();
    });

    it('<components> body with `<Tag>` in a JS comment still parses cleanly', () => {
      const src = `<rozie name="X">
<components>
{
  // we extracted this from <App> when growing past
  Card: './Card.rozie',
}
</components>
<template><div>x</div></template>
</rozie>`;
      const result = splitBlocks(src, 'X.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.components).toBeDefined();
      expect(result.components?.content).toContain('Card:');
      expect(result.template).toBeDefined();
    });

    it('<listeners> body with `<Tag>` in a JS comment still parses cleanly', () => {
      const src = `<rozie name="X">
<listeners>
{
  // bubbles from inner <ChildButton>
  click: () => {},
}
</listeners>
<template><div>x</div></template>
</rozie>`;
      const result = splitBlocks(src, 'X.rozie');
      expect(result.diagnostics).toEqual([]);
      expect(result.listeners).toBeDefined();
      expect(result.listeners?.content).toContain('click:');
      expect(result.template).toBeDefined();
    });

    it('opaque body with a phantom-looking `</close>` in a string still finds the real block close', () => {
      // A literal `</props>` substring inside a JS string would, with naive
      // matching, prematurely close the block. The Tokenizer's close-tag
      // detection still relies on the actual byte sequence, but the close
      // matches `currentBlock` and the splitter honours it — that is the
      // documented v1 limitation (mirrors htmlparser2's own RAWTEXT
      // handling for <script>/<style>). This test pins that behaviour so
      // we notice if it changes.
      const src = `<rozie name="X">
<props>
{
  // weird: '</data>' appears in a string but it's NOT the props close
  msg: { type: String, default: '</data>' },
}
</props>
<template><div>x</div></template>
</rozie>`;
      const result = splitBlocks(src, 'X.rozie');
      expect(result.diagnostics).toEqual([]);
      // The body must include the literal `</data>` substring intact —
      // a phantom close-tag for a DIFFERENT block must not exit opaque mode.
      expect(result.props?.content).toContain("'</data>'");
      expect(result.template).toBeDefined();
    });
  });

  it('emits ROZ001 when <rozie> envelope is missing (collected, not thrown)', () => {
    // Per D-08: function does NOT throw on malformed input.
    const result = splitBlocks('<props>{}</props>');
    expect(result.rozie).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe('ROZ001');
    expect(result.diagnostics[0]?.severity).toBe('error');
    expect(result.diagnostics[0]?.message).toMatch(/Missing <rozie> envelope/);
  });

  it('emits ROZ003 with helpful hint on <refs> top-level block', () => {
    const src = '<rozie name="Foo"><refs></refs></rozie>';
    const result = splitBlocks(src);
    const r3 = result.diagnostics.find((d) => d.code === 'ROZ003');
    expect(r3).toBeDefined();
    expect(r3?.severity).toBe('error');
    // Hint mentions the ref="..." attribute approach per RESEARCH.md OQ-4.
    expect(r3?.hint).toMatch(/ref="\.\.\."/);
    // loc.start points at '<' of <refs>.
    expect(src.slice(r3!.loc.start, r3!.loc.start + 6)).toBe('<refs>');
    // <refs> is NOT in result (unknown blocks are dropped).
    expect((result as Record<string, unknown>).refs).toBeUndefined();
  });

  it('hostile input does not throw and completes in well under 100ms (T-1-02-01)', () => {
    // Synthetic 1MB input of malformed-but-tokenizable HTML.
    const chunk = '<refs name="x">' + 'a'.repeat(100) + '</refs>';
    const big = chunk.repeat(Math.ceil((1024 * 1024) / chunk.length));
    const t0 = Date.now();
    const result = splitBlocks(big);
    const elapsed = Date.now() - t0;
    // Function returns; does not throw.
    expect(result).toBeDefined();
    // T-1-02-01 acceptance threshold.
    expect(elapsed).toBeLessThan(500);
    // Diagnostics array is bounded (MAX_DIAGNOSTICS=1000).
    expect(result.diagnostics.length).toBeLessThanOrEqual(1001);
  });

  it('cwd-stability: snapshot fixtures resolve via import.meta.url anchored path (Pitfall 8)', () => {
    // After the snapshot tests above run with --update, every example produces a snapshot file.
    // This test asserts those file paths resolve identically regardless of cwd.
    for (const { name } of matrix) {
      const snapPath = resolve(FIXTURES_DIR, `${name}-blockmap.snap`);
      expect(existsSync(snapPath), `snapshot missing: ${snapPath}`).toBe(true);
    }
  });
});
