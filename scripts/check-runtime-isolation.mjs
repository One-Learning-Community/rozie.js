#!/usr/bin/env node
// Publish-safety guard: the consumer-runtime packages (@rozie/runtime-*) ship
// into a downstream app's bundle. A React consumer must never transitively pull
// a sibling framework's runtime. Each runtime-* package must therefore be a LEAF
// with ZERO @rozie/* dependencies (deps, peerDeps, or optionalDeps).
//
// This is the real "don't ship a language they don't need" check — the one place
// cross-framework bloat could actually reach a browser. Run in CI before publish.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = join(root, 'packages', 'runtime');

const violations = [];
for (const name of readdirSync(runtimeDir)) {
  const pkgPath = join(runtimeDir, name, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    continue; // not a package dir
  }
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      if (dep.startsWith('@rozie/')) {
        violations.push(`${pkg.name}: ${field} → ${dep} (runtime packages must be @rozie-free leaves)`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('✗ runtime isolation violated — a runtime package would drag in another @rozie package:');
  for (const v of violations) console.error('  - ' + v);
  process.exit(1);
}
console.log('✓ runtime isolation OK — no @rozie/* deps in any runtime package');
