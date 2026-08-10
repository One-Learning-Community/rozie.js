/**
 * docs-surface-guard.mjs — shared drift guard for the hand-written docs
 * Events / Imperative-handle tables.
 *
 * `validateDocsPropsTable` (per-family readme.mjs) already makes the docs
 * Props table un-rottable. The Events and Imperative-handle tables had no
 * such guard, and rotted: the 2026-08-09 docs audit found 31 shipped verbs
 * and one event missing across seven families. This module closes that gap
 * at grep-level fidelity: every `ir.emits` name and every `ir.expose` method
 * name must appear backticked somewhere in the family's docs page(s)
 * (`docs/components/<slug>.md`, plus `<slug>-api.md` for hub families whose
 * API tables live on a dedicated page).
 *
 * Grep-level is deliberate: it asserts presence, not table position or
 * description accuracy — enough to force a human to touch the docs whenever
 * the surface grows, which is the failure mode that actually happened.
 * Backticks delimit the match, so `undo` does not false-match `canUndo`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A name counts as documented if the corpus contains `name` or `name( inside backticks. */
function nameAppears(corpus, name) {
  return corpus.includes(`\`${name}\``) || corpus.includes(`\`${name}(`);
}

/**
 * Core check, side-effect free: returns { ok, missing: { emits, expose }, files }.
 * `ir` — the family's lowered IR (same object codegen already holds).
 * `slug` — the docs slug (the family dir name, e.g. 'sortable-list').
 * `repoRoot` — absolute repo root.
 */
export function checkDocsSurfaceNames(ir, slug, repoRoot) {
  const candidates = [
    resolve(repoRoot, 'docs/components', `${slug}.md`),
    resolve(repoRoot, 'docs/components', `${slug}-api.md`),
  ];
  const files = candidates.filter((p) => existsSync(p));
  const corpus = files.map((p) => readFileSync(p, 'utf8')).join('\n');

  const emitNames = ir.emits ?? [];
  const exposeNames = (ir.expose ?? []).map((m) => (typeof m === 'string' ? m : m.name));

  const missing = {
    emits: emitNames.filter((n) => !nameAppears(corpus, n)),
    expose: exposeNames.filter((n) => !nameAppears(corpus, n)),
  };
  return {
    ok: files.length > 0 && missing.emits.length === 0 && missing.expose.length === 0,
    missing,
    files,
  };
}

/** Throwing wrapper for codegen step (7). */
export function validateDocsSurfaceNames(ir, slug, repoRoot) {
  const { ok, missing, files } = checkDocsSurfaceNames(ir, slug, repoRoot);
  if (files.length === 0) {
    throw new Error(
      `codegen: docs surface validation FAILED — no docs page found for "${slug}" ` +
        `(expected docs/components/${slug}.md and/or ${slug}-api.md)`,
    );
  }
  if (!ok) {
    const lines = [
      ...missing.emits.map(
        (n) =>
          `  - event \`${n}\` is emitted by the source but appears nowhere in: ${files.join(', ')}`,
      ),
      ...missing.expose.map(
        (n) =>
          `  - handle method \`${n}\` is exposed by the source but appears nowhere in: ${files.join(', ')}`,
      ),
    ];
    throw new Error(
      `codegen: docs surface validation DRIFT — the hand-written Events / Imperative-handle docs for "${slug}" ` +
        `are missing shipped surface names. Document them (docs/components/${slug}.md or ${slug}-api.md); ` +
        `do NOT weaken this validator:\n` +
        lines.join('\n'),
    );
  }
  const total = (ir.emits ?? []).length + (ir.expose ?? []).length;
  console.log(
    `codegen: docs surface validation PASS — ${total} emit/handle names present in ${files.length} docs page(s) (ENFORCING; throws on drift)`,
  );
}
