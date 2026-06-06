#!/usr/bin/env node
/**
 * compile-tiptap-check.cjs — Phase-33 dogfood gate for the TipTap node-view slot.
 *
 * Mirrors the Phase-30/32 engine-example compile gate: parse TipTap.rozie once,
 * assert the lowered IR carries the reactive nodeView portal slot AND the
 * Phase-32 surface (8 props / 4 emits / 14 expose / toolbar slot), then compile()
 * across all 6 targets and fail loud on any error-severity diagnostic.
 *
 * Pure GLUE over @rozie/core's public API. No emitter/compiler change.
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
// @rozie/core is a workspace package not hoisted to the repo root; resolve it
// against the tiptap leaf where it IS linked (the codegen runs in that context).
const corePath = require.resolve('@rozie/core', {
  paths: [resolve(ROOT, 'packages/ui/tiptap')],
});
const { compile, createDefaultRegistry, lowerToIR, parse } = require(corePath);

const SRC = resolve(ROOT, 'packages/ui/tiptap/src/TipTap.rozie');
const FILENAME = 'TipTap.rozie';
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const source = readFileSync(SRC, 'utf8');

// ── IR-shape assertions ─────────────────────────────────────────────────────
const { ast } = parse(source, { filename: FILENAME });
const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

// Phase-32 surface must not regress.
if (ir.props.length === 8) ok(`props === 8`);
else fail(`expected 8 props, got ${ir.props.length}`);
if (ir.emits.length === 4) ok(`emits === 4`);
else fail(`expected 4 emits, got ${ir.emits.length}`);
if (ir.expose.length === 14) ok(`expose === 14`);
else fail(`expected 14 expose, got ${ir.expose.length}`);

const toolbar = ir.slots.find((s) => s.name === 'toolbar');
if (toolbar && toolbar.isPortal === true) ok(`toolbar portal slot present`);
else fail(`toolbar portal slot missing/not-portal`);

// The NEW reactive nodeView portal slot.
const nodeView = ir.slots.find((s) => s.name === 'nodeView');
if (!nodeView) {
  fail(`nodeView slot NOT FOUND in IR`);
} else {
  if (nodeView.isPortal === true) ok(`nodeView.isPortal === true`);
  else fail(`nodeView.isPortal !== true`);
  if (nodeView.isReactive === true) ok(`nodeView.isReactive === true`);
  else fail(`nodeView.isReactive !== true`);
  const names = (nodeView.portalParamNames || []).join(',');
  ok(`nodeView portal params: [${names}]`);
}

// addNodeView wiring must be in the source.
if (/addNodeView/.test(source)) ok(`addNodeView present in source`);
else fail(`addNodeView NOT present in source`);
if (/data-rozie-hole/.test(source)) ok(`[data-rozie-hole] placeholder present in source`);
else fail(`[data-rozie-hole] placeholder NOT present in source`);

// ── Cross-target compile (zero error diagnostics) ───────────────────────────
for (const target of TARGETS) {
  const r = compile(source, { target, filename: FILENAME });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) {
    fail(`${target}: ${errs.map((e) => `${e.code} ${e.message}`).join('; ')}`);
  } else {
    ok(`${target}: compiled clean (${r.code.length} bytes)`);
  }
}

if (failed) {
  console.error('\ncompile-tiptap-check: FAILED');
  process.exit(1);
}
console.log('\ncompile-tiptap-check: PASS — reactive nodeView slot + Phase-32 surface, 6/6 clean.');
