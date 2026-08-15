/**
 * display-name.mjs — shared path constants + the `<Name>` resolver used by
 * every docs generator under `docs/scripts/`.
 *
 * Extracted from `gen-usage-pages.mjs` (which cannot be imported directly —
 * it ends with a top-level `await main()`) so `gen-theming-pages.mjs` can
 * reuse the exact same display-name logic without a second copy.
 *
 * Side-effect-free: importing this module reads nothing and writes nothing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const UI_DIR = resolve(REPO_ROOT, 'packages', 'ui');
export const COMPONENTS_DIR = resolve(HERE, '..', 'components');

/** Derive the component display name (e.g. `DataTable`) from the generated
 * React README's "Idiomatic **react** `Name`" line — a uniform, generated
 * source. Falls back to the slug. */
export function displayNameFor(slug) {
  const readme = resolve(UI_DIR, slug, 'packages', 'react', 'README.md');
  if (existsSync(readme)) {
    const m = readFileSync(readme, 'utf8').match(/Idiomatic \*\*[a-z]+\*\* `([A-Za-z][\w]*)`/);
    if (m) return m[1];
  }
  return slug;
}
