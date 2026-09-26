import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260926 audit follow-up to quick 260925-r41 (TipTap's `ready` event).
 *
 * Reported from the same audit as tiptap-remount-race.spec.ts /
 * tiptap-async-model-race.spec.ts: `Promise.all([...import()]).then(...)` (TipTap.rozie
 * ~1053-1063) had NO rejection handling. A failed chunk load (a real-world CDN/network
 * blip on the optional character-count/floating-menu/image extensions) left the editor
 * PERMANENTLY uncreated — silently: no error surfaced, no `ready`, nothing — because an
 * unhandled rejection on the internal Promise.all just evaporates.
 *
 * The fix: each optional import() is now caught INDIVIDUALLY (so one failure can't sink
 * the whole Promise.all), reported via `console.error` + a new `error` event
 * (`{ extension, error }`, matching the RecaptchaV3/Captcha/MapLibre/PdfViewer/Waveform
 * `$emit('error', ...)` convention), and construction proceeds WITHOUT the failed
 * extension (degrade — a network blip on `maxLength` shouldn't blank the whole editor).
 *
 * This spec identifies the CharacterCount chunk request by CONTENT (a small chunk whose
 * body references `CharacterCount`), not by filename — Rollup's default chunk-naming
 * assigns opaque names like `dist-<hash>.js` to this dependency's own re-export shim, and
 * matching by content is robust to that across rebuilds. React-only: the fix itself is
 * target-agnostic pure `<script>` logic (identical compiled behavior on all 6 targets —
 * see lazy-extensions.test.ts for the per-leaf dynamic-import() assertion), so proving the
 * mechanism on one target is sufficient; a full 6-target network-chunk-identification
 * harness would multiply the fragility of content-sniffing for no additional coverage.
 */

const target = 'react' as const;
const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));

(built ? test : test.fixme)('tiptap import failure [react]: a failed optional-extension chunk degrades instead of leaving the editor permanently uncreated', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Identify + abort the CharacterCount chunk by CONTENT, not filename (see header).
  // Small (<2000 chars, comfortably above the ~100-byte re-export shim we found
  // empirically, generous enough to survive a differently-shaped bundle) AND
  // references CharacterCount — the main TipTap chunk is 100+ KB and would never
  // match the size gate.
  await page.route('**/*.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.length < 2000 && /CharacterCount/.test(body)) {
      return route.abort('failed');
    }
    return route.fulfill({ response });
  });

  await page.goto(`/?example=TipTapReady&target=${target}`);
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();

  // The `plain` cell needs no optional extension — unaffected by the aborted chunk.
  await expect(mount.getByTestId('plain-ready')).toHaveText('ready', { timeout: 10_000 });

  // The `counted` cell's CharacterCount import failed — it still constructs (degrade),
  // reports the error with context, and its own editor.
  await expect(mount.getByTestId('counted-ready')).toHaveText('ready', { timeout: 10_000 });
  await expect(mount.getByTestId('counted-error')).toHaveText('count', { timeout: 5_000 });
  await expect(mount.getByTestId('counted').locator('.ProseMirror')).toBeVisible();

  // The failure is also surfaced to the console with actionable context (not just
  // silently swallowed by the `error` event) — the "at minimum surface it" half of
  // the fix.
  expect(consoleErrors.some((m) => m.includes('@rozie-ui/tiptap') && m.includes('count'))).toBe(true);
});
