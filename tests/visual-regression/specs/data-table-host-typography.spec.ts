import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260925-mzw (UAT F4) — the DataTable toolbar must survive the host page's typography CSS.
 *
 * Content sites style bare elements: VitePress ships `.vp-doc summary { margin: 16px 0 }`, and
 * Tailwind's `prose` and most CMS themes do the same. The toolbar is a flex row of the global
 * search <input> and the column-visibility <details>. A host margin on the <summary> grew the
 * <details> to summary + 32px (66px on the docs site), and the flex row stretched the search
 * input to match — an empty 66px box next to "Columns". The component sets the summary's
 * padding and border but did not own its margin.
 *
 * The host rule is injected into the DOCUMENT. On Lit the <summary> is inside the component's
 * shadow root, which a document stylesheet cannot reach, so that leg holds with or without the
 * fix; the five light-DOM targets are the ones the fix has to protect.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return built ? test : test.fixme;
}

// What a content site's typography layer does to a bare <summary>.
const HOST_TYPOGRAPHY = 'summary { margin: 16px 0; }';

for (const target of TARGETS) {
  runnerFor(target)(`data-table host typography [${target}]: a host summary margin does not stretch the toolbar`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableFilterDropins&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    const table = mount.getByTestId('filter-table');
    await expect(table.locator('table')).toBeVisible({ timeout: 15_000 });

    await page.addStyleTag({ content: HOST_TYPOGRAPHY });

    const summary = table.locator('summary.rdt-colvis-summary');
    const details = table.locator('details.rdt-colvis');
    const search = table.locator('input.rdt-global-filter');
    await expect(summary).toBeVisible();

    const h = async (l: typeof summary) => (await l.boundingBox())!.height;
    const [summaryH, detailsH, searchH] = [await h(summary), await h(details), await h(search)];

    // The disclosure is exactly as tall as its closed summary — no host margin inside it —
    // and the search input is not stretched past it.
    expect(detailsH, `details ${detailsH}px vs summary ${summaryH}px`).toBeLessThanOrEqual(summaryH + 1);
    expect(searchH, `search input ${searchH}px vs summary ${summaryH}px`).toBeLessThanOrEqual(summaryH + 1);
  });
}
