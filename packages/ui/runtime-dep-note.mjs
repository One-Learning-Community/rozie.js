/**
 * Shared README helper: disclose the `@rozie/runtime-*` dependency a compiled
 * leaf actually carries.
 *
 * 132 of the 174 published `@rozie-ui/*` packages depend on a Rozie runtime
 * helper package, but the generated Install sections used to list only the
 * framework peer — so `npm i @rozie-ui/switch-react` silently pulled a
 * dependency no README mentioned.
 *
 * The note is DERIVED from each leaf's own package.json, never hardcoded: the
 * set varies per target (all 29 Lit/Solid/Svelte leaves carry one, only 16 of
 * 29 Vue leaves do, and Angular carries one only for `r-keynav`). Hardcoding
 * would drift the moment an emitter change adds or drops a runtime import.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_ROOT = dirname(fileURLToPath(import.meta.url));

const RUNTIME_DOCS_URL =
  'https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md';

/** pkgName -> sorted list of @rozie/runtime-* deps. Built once per process. */
let INDEX = null;

function buildIndex() {
  const index = new Map();
  for (const family of readdirSync(UI_ROOT, { withFileTypes: true })) {
    if (!family.isDirectory()) continue;
    const leavesDir = join(UI_ROOT, family.name, 'packages');
    if (!existsSync(leavesDir)) continue;
    for (const leaf of readdirSync(leavesDir, { withFileTypes: true })) {
      if (!leaf.isDirectory()) continue;
      const manifestPath = join(leavesDir, leaf.name, 'package.json');
      if (!existsSync(manifestPath)) continue;
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch {
        continue; // Unreadable manifest is the codegen's problem, not ours.
      }
      if (!manifest.name) continue;
      const runtimeDeps = Object.keys(manifest.dependencies ?? {})
        .filter((d) => d.startsWith('@rozie/runtime-'))
        .sort();

      // Declared and imported are NOT the same thing: 12 of the 16 Vue leaves
      // declare @rozie/runtime-vue without importing a symbol from it. npm
      // still installs it, so the note must appear — but it must not claim an
      // import that isn't there.
      const srcDir = join(leavesDir, leaf.name, 'src');
      let imported = false;
      if (runtimeDeps.length > 0 && existsSync(srcDir)) {
        for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          const text = readFileSync(join(srcDir, entry.name), 'utf8');
          if (runtimeDeps.some((d) => text.includes(d))) { imported = true; break; }
        }
      }
      index.set(manifest.name, { runtimeDeps, imported });
    }
  }
  return index;
}

/**
 * Render the runtime-dependency disclosure for a leaf, or `null` when that
 * leaf genuinely imports nothing from the runtime (most Vue and Angular
 * builds). Returning `null` keeps the honest "no runtime here" case honest.
 *
 * @param {string} pkgName e.g. `@rozie-ui/switch-react`
 * @returns {string | null}
 */
export function runtimeDepNote(pkgName) {
  if (!INDEX) INDEX = buildIndex();
  const entry = INDEX.get(pkgName);
  if (!entry || entry.runtimeDeps.length === 0) return null;

  const { runtimeDeps, imported } = entry;
  const list = runtimeDeps.map((d) => `\`${d}\``).join(' and ');
  const onlyKeynav = runtimeDeps.every((d) => d === '@rozie/runtime-keynav-core');
  const contents = onlyKeynav
    ? 'the keyboard-navigation state machine behind `r-keynav`'
    : 'controllable state, keyboard navigation, event modifiers, and safe interpolation';

  const tail = imported
    ? `Your bundler keeps only the helpers this component actually uses — typically ` +
      `a few hundred bytes to a few KB, minified and gzipped.`
    : `This build imports nothing from it today, so it shakes out of your bundle ` +
      `entirely.`;

  return (
    `Also installed: ${list} — Rozie's small, tree-shaken runtime helper ` +
    `${runtimeDeps.length > 1 ? 'packages' : 'package'} (${contents}). It arrives as a ` +
    `regular dependency, so npm pulls it for you. ${tail} ` +
    `[What's in it and what it costs](${RUNTIME_DOCS_URL}).`
  );
}
