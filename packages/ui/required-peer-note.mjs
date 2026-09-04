/**
 * Shared README helper: disclose the FULL non-optional peer chain a compiled
 * leaf actually requires, beyond its own framework.
 *
 * The combobox / popover / command-palette wave composes published leaves at
 * runtime — combobox declares `@rozie-ui/popover-<target>` as a NON-optional
 * peer (which itself requires `@floating-ui/dom`), and command-palette goes
 * one hop further through `@rozie-ui/combobox-<target>`. None of that was
 * ever disclosed in the generated Install section, so `npm i
 * @rozie-ui/combobox-react` silently left a consumer two peers short with no
 * error until first render.
 *
 * Mirrors `runtime-dep-note.mjs`'s structure: a module-level index built once
 * over every `packages/ui/*\/packages/*\/package.json`, tolerant of unreadable
 * manifests, exporting one function that returns a string or null. Every
 * range is READ from the manifest — never hardcoded — so a future range
 * change (settled elsewhere, never here) cannot drift this disclosure.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_ROOT = dirname(fileURLToPath(import.meta.url));

// Framework peers each family's own FRAMEWORK_PEER_LABEL constant already
// names in the "Peer dependencies: …" line directly above where this note is
// rendered — dropped here so this block only ever discloses what that line
// does NOT already say. NOT including `@floating-ui/dom`: popover's own
// label already names it (so it re-appears in popover's own note, which is
// correct — it's the base of the chain), but combobox/command-palette's
// labels do NOT name it, which is exactly the defect this note exists to fix
// for those two families.
const FRAMEWORK_PEER_NAMES = new Set([
  'react',
  'react-dom',
  'vue',
  'svelte',
  'solid-js',
  'lit',
  '@lit-labs/preact-signals',
  '@preact/signals-core',
  '@angular/core',
  '@angular/common',
  '@angular/forms',
]);

/** pkgName -> parsed package.json. Built once per process. */
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
      index.set(manifest.name, manifest);
    }
  }
  return index;
}

/**
 * A leaf's own directly-declared non-optional, non-framework peers, as
 * `{ name, range }` pairs, sorted by name for deterministic output.
 */
function directRequiredPeers(pkgName) {
  const manifest = INDEX.get(pkgName);
  if (!manifest) return [];
  const peers = manifest.peerDependencies ?? {};
  const meta = manifest.peerDependenciesMeta ?? {};
  const names = Object.keys(peers)
    .filter((name) => !FRAMEWORK_PEER_NAMES.has(name))
    .filter((name) => meta[name]?.optional !== true)
    .sort();
  return names.map((name) => ({ name, range: peers[name] }));
}

/**
 * Render the required-peer-chain disclosure for a leaf, or `null` when it
 * requires nothing beyond its own framework peers (most leaves — this wave's
 * three composed families are the exception, not the rule).
 *
 * Breadth-first: collect the leaf's own direct required peers, then for any
 * of THOSE that are themselves `@rozie-ui/*` packages, walk into their own
 * manifest for further required peers, and so on — visited-set guarded
 * against cycles, sorted at each level for deterministic output.
 *
 * @param {string} pkgName e.g. `@rozie-ui/combobox-react`
 * @returns {string | null}
 */
export function requiredPeerNote(pkgName) {
  if (!INDEX) INDEX = buildIndex();

  const chain = []; // { name, range, requiredBy }
  const visited = new Set([pkgName]);
  let frontier = directRequiredPeers(pkgName).map((p) => ({ ...p, requiredBy: pkgName }));

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.name.localeCompare(b.name));
    const next = [];
    for (const entry of frontier) {
      if (!chain.some((c) => c.name === entry.name)) chain.push(entry);
      if (entry.name.startsWith('@rozie-ui/') && !visited.has(entry.name)) {
        visited.add(entry.name);
        for (const sub of directRequiredPeers(entry.name)) {
          next.push({ ...sub, requiredBy: entry.name });
        }
      }
    }
    frontier = next;
  }

  if (chain.length === 0) return null;

  const rows = chain.map(
    (c) => `- \`${c.name}\` \`${c.range}\` — required by \`${c.requiredBy}\``,
  );

  const installTargets = [pkgName, ...chain.map((c) => c.name)];

  return (
    `**Required peers** — beyond the framework peer above, this package requires ` +
    `these non-optional peers to actually render:\n\n` +
    `${rows.join('\n')}\n\n` +
    `Install the whole chain in one line:\n\n` +
    '```bash\n' +
    `npm i ${installTargets.join(' ')}\n` +
    '```'
  );
}
