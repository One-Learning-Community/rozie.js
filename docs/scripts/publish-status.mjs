/**
 * publish-status.mjs — single source of truth for which framework targets of
 * a not-yet-fully-published `@rozie-ui` family are actually on npm today.
 *
 * A family absent from `PARTIAL_DEBUTS` is assumed fully published (all six
 * targets) — the default, unmarked case that covers the vast majority of
 * `@rozie-ui` families. Only a family mid-debut (one or more targets shipped,
 * the rest still dogfooding) or fully held back (zero targets shipped) needs
 * an entry here.
 *
 * Consumed by:
 *   - `gen-usage-pages.mjs` (per-family intro wording, per-tab caveat
 *     comments, and the `publishedTargets`/`family` frontmatter read by the
 *     `<PublishedTargetsNotice>` VitePress component).
 *   - Hand-authored family index pages (`docs/components/<slug>.md`), which
 *     pass the same data as explicit props to `<PublishedTargetsNotice>`
 *     since those pages are not generated.
 *
 * Update this map (and only this map) the next time a family's debut widens
 * — e.g. a second target ships, or a family goes from partial to fully
 * published. Nothing else needs to change; the notice, the usage-page
 * caveats, and the intro wording all derive from it.
 */

export const ALL_TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

export const TARGET_LABELS = {
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  angular: 'Angular',
  solid: 'Solid',
  lit: 'Lit',
};

// slug -> array of target ids actually published to npm. An empty array
// means the family is fully held back (no target published yet, including
// its Solid leaf, e.g. `lexical` — no content read/write API yet).
export const PARTIAL_DEBUTS = {
  dialog: ['solid'],
  listbox: ['solid'],
  maplibre: ['solid'],
  'number-field': ['solid'],
  pagination: ['solid'],
  resizable: ['solid'],
  slider: ['solid'],
  switch: ['solid'],
  lexical: [],
};

/** The targets actually published to npm for `slug` (all six if not a partial debut). */
export function publishedTargets(slug) {
  return PARTIAL_DEBUTS[slug] ?? ALL_TARGETS;
}

/** Whether `slug` needs the partial-debut notice / caveats at all. */
export function isPartialDebut(slug) {
  return Object.prototype.hasOwnProperty.call(PARTIAL_DEBUTS, slug);
}

/** The targets NOT yet published to npm for `slug` ([] if not a partial debut). */
export function unpublishedTargets(slug) {
  if (!isPartialDebut(slug)) return [];
  const published = new Set(publishedTargets(slug));
  return ALL_TARGETS.filter((t) => !published.has(t));
}
