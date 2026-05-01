// PARSE-05 — <listeners> block parser scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 04. Anchors paths per RESEARCH.md Pitfall 8.
//
// Two-stage parse per D-15: (1) parseExpression on the block content as an
// ObjectExpression; (2) per-key modifier-PEG post-process to extract
// target:event + ModifierChain.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

describe('parseListeners (PARSE-05)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
  });

  it.todo('Dropdown.rozie listeners parses to ObjectExpression with three keys (D-15 stage 1)');
  it.todo('Dropdown.rozie key "document:click.outside($refs.triggerEl, $refs.panelEl)" splits into target=document, event=click, ModifierChain=[outside(refExpr,refExpr)] via D-15 stage 2');
  it.todo('Dropdown.rozie keys carry handler references resolvable from <script> scope');
  it.todo('emits ROZ010 when listener key is not a string literal');
});
