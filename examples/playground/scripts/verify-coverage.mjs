#!/usr/bin/env node
// Headless playground coverage gate (Phase 68-01).
//
// Drives the LIVE workspace `@rozie/core` `compile()` over each family the
// playground claims to cover, for all six targets, and fails the process if ANY
// target produces an error-severity diagnostic (ROZ945 cross-package lookup
// miss, or anything else). This is the automated companion to the in-browser
// render check: the playground's real gate is "does it live-render," which a
// headless node script can't assert — but "does it COMPILE ×6 clean" it can,
// and that's the invariant every BUNDLE_DECLS entry must hold.
//
// Unlike the browser path (which feeds sources through a VFS), this resolves
// each demo's `<components>` siblings + `./internal/*` helpers straight off the
// real on-disk filesystem via @rozie/core's own enhanced-resolve. So it also
// proves the demo entry + its package sources agree on-disk.
//
// EXTENDING: later 68 plans append their newly-wired families to `FAMILIES`.
// Keep entries as `{ family, demo }` — `demo` is the entry basename under
// examples/demos/. Run: `node examples/playground/scripts/verify-coverage.mjs`.

import { compile } from '@rozie/core';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/ -> playground/ -> examples/ -> <repo root>
const REPO_ROOT = resolve(__dirname, '../../..');
const DEMOS_DIR = resolve(REPO_ROOT, 'examples/demos');

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

// The families this plan (68-01) wires into BUNDLE_DECLS. Later plans append.
const FAMILIES = [
  { family: 'dialog', demo: 'DialogBehaviorDemo' },
  { family: 'slider', demo: 'SliderBehaviorDemo' },
  { family: 'tags', demo: 'TagsBehaviorDemo' },
  { family: 'switch', demo: 'SwitchBehaviorDemo' },
  { family: 'otp', demo: 'OtpBehaviorDemo' },
  { family: 'number-field', demo: 'NumberFieldBehaviorDemo' },
  { family: 'toast', demo: 'ToasterBehaviorDemo' },
  { family: 'date-picker', demo: 'DatePickerBehaviorDemo' },
  { family: 'pagination', demo: 'PaginationBehaviorDemo' },
  { family: 'popover', demo: 'PopoverBehaviorDemo' },
  { family: 'resizable', demo: 'ResizableBehaviorDemo' },
  // Phase 68-02 — the `.rzts`/`.rzjs` script-partial-consuming families. Each
  // inlines a cross-package `@rozie-ui/headless-core/*.rzts` partial at compile
  // time; this gate proves @rozie/core resolves + inlines them ×6 clean off the
  // real on-disk workspace (headless-core is a real pnpm-workspace package).
  { family: 'headless-core', demo: 'HeadlessCoreSmokeDemo' },
  { family: 'combobox', demo: 'ComboboxBehaviorDemo' },
  { family: 'listbox', demo: 'ListboxVirtualDemo' },
  { family: 'command-palette', demo: 'CommandPaletteBehaviorDemo' },
];

let failures = 0;

for (const { family, demo } of FAMILIES) {
  const entry = resolve(DEMOS_DIR, `${demo}.rozie`);
  let source;
  try {
    source = readFileSync(entry, 'utf8');
  } catch {
    console.error(`FAIL  ${family.padEnd(14)} — missing demo entry ${demo}.rozie`);
    failures++;
    continue;
  }

  const bad = [];
  for (const target of TARGETS) {
    const result = compile(source, {
      target,
      filename: entry,
      resolverRoot: REPO_ROOT,
      types: false,
      sourceMap: false,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    if (errors.length > 0) {
      bad.push(`${target}[${errors.map((e) => e.code).join(',')}]`);
    }
  }

  if (bad.length > 0) {
    console.error(`FAIL  ${family.padEnd(14)} ${demo} — ${bad.join(' ')}`);
    failures++;
  } else {
    console.log(`ok    ${family.padEnd(14)} ${demo} — clean x${TARGETS.length}`);
  }
}

if (failures > 0) {
  console.error(`\nverify-coverage: ${failures} FAMILY(IES) FAILED — see ROZ codes above.`);
  process.exit(1);
}

console.log(`\nverify-coverage: all ${FAMILIES.length} families compile clean x${TARGETS.length}.`);
