import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Spike 003 — portal-slot primitive runtime smoke (Playwright).
 *
 * Compile-time tests (packages/core/tests/portal-slot.test.ts) prove the
 * 6-target compile path emits the expected closures + dispose tracking.
 * They do NOT prove the mount path executes correctly at runtime — per
 * memory `feedback_vite_build_vs_dev_node_isms`, build green ≠ runtime
 * green when bundling Node-shaped libraries.
 *
 * This spec is the runtime gate. It exercises `examples/demos/PortalListDemo.rozie`
 * (which imports `examples/PortalList.rozie`) on each of the 6 targets:
 *   1. PortalList's $onMount instantiates the inline MiniListEngine
 *   2. The engine calls `cellRenderer(item)` for each item in $props.items
 *   3. cellRenderer invokes `$portals.item(node, { item })`
 *   4. The per-target portal helper mounts the consumer's `<template #item>`
 *      content into the engine-owned cell node
 *   5. Each row's mounted content reflects the consumer's templated markup:
 *        <span class="portal-list-demo__swatch" :style="background: <color>">…</span>
 *        <code class="portal-list-demo__id">#<id></code>
 *        <strong class="portal-list-demo__label"><label></strong>
 *
 * The matrix screenshot (matrix.spec.ts `PortalList.png`) covers pixel
 * appearance; this spec asserts the structural mount succeeded with the
 * expected per-item content/order. The two layers are complementary —
 * the matrix would let a "renders nothing" regression slip through if the
 * baseline happened to be blank; this spec catches it via explicit content
 * assertions.
 *
 * D-10 (matrix shared-baseline rule) does NOT apply here — this spec
 * doesn't take screenshots, it makes structural assertions instead.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Phase 07.5 closure — LIT_PORTAL_GAP removed once consumer-side function-prop
// emit landed for portal slots. Lit now emits `.item=${(scope) => html\`…\`}`
// on the producer's open tag (instead of `<element slot="item">`), and the
// 4 engine-owned cells render correctly.

// Build-availability gate — matches the matrix.spec.ts pattern. When
// `dist/<target>/host/entry.<target>.html` is absent (Angular soft-fails on
// the upstream Vite-version breakage flagged in scripts/build-cells.mjs),
// the corresponding test is `test.fixme` so the harness reports it as
// known-pending instead of failing the whole job with a 404.
const ITEMS = [
  { id: 1, label: 'Alpha' },
  { id: 2, label: 'Beta' },
  { id: 3, label: 'Gamma' },
  { id: 4, label: 'Delta' },
];

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;
  runner(`portal-list [${target}]: mounts each row through $portals.item`, async ({
    page,
  }) => {
    await page.goto(`/?example=PortalList&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Locate rows by stable data attributes — class names get hashed by
    // React/Solid's CSS Modules pipeline, rewritten by Angular's view
    // encapsulation, and bounded by Lit's shadow DOM. The data-* hooks the
    // demo emits survive all four. `mount.locator` already pierces shadow
    // boundaries via Playwright's default selector engine.
    const labels = mount.locator('[data-portal-list-label]');
    await expect(labels).toHaveCount(ITEMS.length);
    for (let i = 0; i < ITEMS.length; i++) {
      await expect(labels.nth(i)).toHaveText(ITEMS[i]!.label);
    }

    // Per-item id codes — `#1`, `#2`, etc. — exercise the scoped slot's
    // `{{ item.id }}` interpolation across all 6 targets.
    const ids = mount.locator('[data-portal-list-id]');
    await expect(ids).toHaveCount(ITEMS.length);
    for (let i = 0; i < ITEMS.length; i++) {
      await expect(ids.nth(i)).toHaveText(`#${ITEMS[i]!.id}`);
    }

    // Per-row text — id codes + labels — exercises the scoped slot's
    // `{{ item.id }}` / `{{ item.label }}` interpolations across all 6
    // targets, and proves the portal MOUNT successfully deposited the
    // consumer's fragment into each engine-owned cell.
  });
}
