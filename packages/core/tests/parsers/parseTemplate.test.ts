// PARSE-04 — <template> block parser scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 03. Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

describe('parseTemplate (PARSE-04)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
  });

  it.todo('SearchInput.rozie r-model directive parsed on <input>');
  it.todo('TodoList.rozie r-for="item in items" with required :key recognised');
  it.todo('Counter.rozie r-if / r-else-if / r-else chain parsed');
  it.todo(':prop="expr" shorthand recognised on Counter.rozie button bindings');
  it.todo('@event="expr" shorthand recognised on Counter.rozie button bindings');
  it.todo('mustache {{ }} interpolation in plain attribute values: :class="{ hovering: $data.hovering }" (Vue forbids this; Rozie permits per PROJECT.md)');
  it.todo('mustache {{ }} in attribute strings: aria-label="Close {{ $props.title }}"');
  it.todo('emits ROZ050 on unclosed template element');
  it.todo('emits ROZ051 on malformed mustache {{ }}');
});
