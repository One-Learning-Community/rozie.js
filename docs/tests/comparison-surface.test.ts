// comparison-surface.test.ts — the per-family comparison-page staleness gate.
//
// Background: `docs/components/<slug>-comparison.md` pages hand-assert capability
// claims about `@rozie-ui/<slug>` ("single or range", "two-way model", "headless
// slot", "focus()/clear() handle"…). Unlike the codegen-validated `### Props` table in
// `<slug>.md`, that prose is protected by nothing. Phase 62 shipped date-picker range
// selection while the comparison page silently kept claiming "single-date only" until a
// human noticed (fixed in 048aa120).
//
// This test recomputes each family's compiled public surface (props / model props /
// emits / slots / $expose, via the @rozie/core IR — the same primitive the per-family
// surface gates and codegen use) and asserts the page's recorded `surface_hash:`
// frontmatter marker still matches. When a family's surface drifts, the marker no
// longer matches and this test fails with an ACTIONABLE message instructing a human to
// re-read the comparison page and update the marker.
//
// Comparison pages that map to no shipped family package (none today, but
// landscape/competitor pages could be added later) get `computeSurfaceHash() === null`
// and are skipped gracefully — never a false failure.
import { describe, it, expect } from 'vitest';

import {
  listComparisonSlugs,
  computeSurfaceHash,
  readSurfaceMarker,
} from '../scripts/surface-hash.mjs';

const slugs = listComparisonSlugs();

describe('comparison-page surface-hash drift gate', () => {
  it.each(slugs)('%s comparison page reflects the shipped surface', (slug) => {
    const expected = computeSurfaceHash(slug);

    if (expected === null) {
      // No family package behind this comparison page — nothing to guard. Pass.
      expect(expected).toBeNull();
      return;
    }

    const recorded = readSurfaceMarker(slug);

    // A family-backed page MUST carry a marker, so new families can't skip the gate.
    expect(
      recorded,
      `${slug} comparison page is missing its surface_hash marker — add ` +
        `\`surface_hash: ${expected}\` to the frontmatter of ` +
        `docs/components/${slug}-comparison.md (run ` +
        `\`node scripts/surface-hash.mjs --write\` to seed it), then confirm the ` +
        `page's capability claims still match the shipped surface.`,
    ).not.toBeNull();

    expect(
      recorded,
      `${slug} surface changed since its comparison page was last reviewed — re-read ` +
        `docs/components/${slug}-comparison.md, confirm it's still accurate, and update ` +
        `surface_hash to ${expected}.`,
    ).toBe(expected);
  });
});
