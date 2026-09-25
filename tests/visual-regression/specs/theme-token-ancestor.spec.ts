/**
 * theme-token-ancestor.spec.ts — every @rozie-ui family's `themes/base.css` promises
 * "override any token at any ancestor scope (`:root`, `.dark`, a wrapper…)". A value an
 * element declares for itself always beats one it would inherit, whatever the selector's
 * specificity, so a base.css that declares its defaults on the component's OWN class makes
 * every ancestor override dead the moment it is imported (the defect data-table fixed in
 * 15f499b78). One parameterized spec, one row per family, measures it on all six targets.
 *
 * The stylesheet is injected exactly as a consumer imports it (the family's source
 * `src/themes/base.css`, read from disk here), into a demo that already renders the family's
 * component at mount. Custom-property values are read with getComputedStyle on the element
 * base.css targets (inside the component's shadow root on Lit — Playwright's locator pierces
 * open shadow roots; the tokens inherit across the boundary).
 *
 * Three assertions per family × target:
 *  1. with nothing set, base.css's defaults reach the component (every declared token that
 *     is a plain value, not derived from another token and not a CSS-wide keyword);
 *  2. every declared public token set on an ANCESTOR (<body>) wins at the component;
 *  3. every token the pre-fix base.css DERIVED from another (`--ring: var(--accent)`) follows
 *     that source when the source is set on an ancestor — i.e. its default is resolved at the
 *     component, never computed once at the document root against the root's source.
 *
 * Families with a built-in dark palette (rete: FlowCanvas ships an OS-driven dark default in
 * its own SFC, and base.css adds the `.dark` / `[data-theme="dark"]` class strategy) get four
 * more cases: the dark palette is still the default (OS dark with nothing imported; a `.dark`
 * root with base.css), a `.light` root still opts out, and under OS dark or a `.dark` root
 * every dark-palette token set on an ancestor wins — with and without base.css.
 *
 * Behavioral-only (no pixel baseline).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
const UI = resolve(__dirname, '../../../packages/ui');

interface Family {
  family: string;
  example: string;
  root: string;
  /** Tokens the pre-fix base.css declared as a function of another public token. */
  derived: Record<string, string>;
  /** Tokens the component itself sets inline from a prop/state (base.css lists them for
   * reference only; the inline value rightly beats any stylesheet or ancestor). */
  owned?: string[];
  /** A token and its dark-palette value, when the family ships a dark default. */
  dark?: [string, string];
}

const FAMILIES: Family[] = [
  {
    family: 'combobox',
    example: 'ComboboxMulti',
    root: '.rozie-combobox',
    derived: {
      '--rozie-combobox-focus-border-color': '--rozie-combobox-accent',
      '--rozie-combobox-option-selected-color': '--rozie-combobox-accent',
      '--rozie-combobox-create-color': '--rozie-combobox-accent',
      '--rozie-combobox-chip-remove-hover-color': '--rozie-combobox-accent',
    },
  },
  {
    family: 'command-palette',
    example: 'CommandPaletteScreenshot',
    root: '.rozie-command-palette',
    derived: {
      '--rozie-command-palette-breadcrumb-jump-hover-color': '--rozie-command-palette-breadcrumb-current-color',
      '--rozie-command-palette-hotkey-bg': '--rozie-command-palette-actions-hint-bg',
      '--rozie-command-palette-hotkey-color': '--rozie-command-palette-actions-hint-color',
      '--rozie-command-palette-hotkey-font-size': '--rozie-command-palette-actions-hint-font-size',
      '--rozie-command-palette-hotkey-padding': '--rozie-command-palette-actions-hint-padding',
      '--rozie-command-palette-hotkey-radius': '--rozie-command-palette-actions-hint-radius',
      '--rozie-command-palette-args-field-bg': '--rozie-command-palette-input-bg',
      '--rozie-command-palette-args-field-padding': '--rozie-command-palette-input-padding',
      '--rozie-command-palette-args-field-radius': '--rozie-command-palette-input-radius',
      '--rozie-command-palette-input-underline': '--rozie-command-palette-divider-color',
      '--rozie-command-palette-args-field-border': '--rozie-command-palette-divider-color',
    },
  },
  {
    family: 'date-picker',
    example: 'DatePickerScreenshot',
    root: '.rozie-datepicker',
    derived: {
      '--rozie-datepicker-ring': '--rozie-datepicker-accent',
      '--rozie-datepicker-today-border': '--rozie-datepicker-accent',
      '--rozie-datepicker-selected-bg': '--rozie-datepicker-accent',
      '--rozie-datepicker-selected-hover-bg': '--rozie-datepicker-selected-bg',
      '--rozie-datepicker-range-endpoint-bg': '--rozie-datepicker-selected-bg',
    },
  },
  { family: 'dialog', example: 'DialogScreenshot', root: '.rozie-dialog', derived: {} },
  {
    family: 'embla',
    example: 'Carousel',
    root: '.rozie-embla',
    derived: {
      '--rozie-embla-arrow-fg': '--rozie-embla-accent',
      '--rozie-embla-dot-selected-bg': '--rozie-embla-accent',
      '--rozie-embla-thumb-selected-border-color': '--rozie-embla-accent',
    },
  },
  {
    family: 'listbox',
    example: 'ListboxBehavior',
    root: '.rozie-listbox',
    derived: {
      '--rozie-listbox-ring': '--rozie-listbox-accent',
      '--rozie-listbox-popup-bg': '--rozie-listbox-bg',
      '--rozie-listbox-popup-border': '--rozie-listbox-border',
      '--rozie-listbox-popup-radius': '--rozie-listbox-radius',
      '--rozie-listbox-check-color': '--rozie-listbox-accent',
    },
  },
  { family: 'number-field', example: 'NumberFieldBehavior', root: '.rozie-number-field', derived: {} },
  {
    family: 'otp',
    example: 'OtpBehavior',
    root: '.rozie-otp',
    derived: { '--rozie-otp-filled-border-color': '--rozie-otp-accent' },
  },
  {
    family: 'pagination',
    example: 'PaginationBehavior',
    root: '.rozie-pagination',
    derived: {
      '--rozie-pagination-active-bg': '--rozie-pagination-accent',
      '--rozie-pagination-active-border': '--rozie-pagination-accent',
      '--rozie-pagination-ring': '--rozie-pagination-accent',
    },
  },
  { family: 'popover', example: 'PopoverScreenshot', root: '.rozie-popover', derived: {} },
  {
    family: 'rete',
    example: 'FlowCanvasScreenshot',
    root: '.rozie-flow-canvas',
    derived: {
      '--rozie-flow-node-selected-border': '--rozie-flow-accent',
      '--rozie-flow-socket-hover-bg': '--rozie-flow-accent',
      '--rozie-flow-connection-selected-stroke': '--rozie-flow-accent',
      '--rozie-flow-control-selected-border': '--rozie-flow-accent',
      '--rozie-flow-marquee-bg': '--rozie-flow-accent',
      '--rozie-flow-marquee-border': '--rozie-flow-accent',
      '--rozie-flow-resize-handle-border': '--rozie-flow-accent',
      '--rozie-flow-focus-ring': '--rozie-flow-accent',
    },
    dark: ['--rozie-flow-bg', '#0f172a'],
  },
  {
    family: 'resizable',
    example: 'ResizableScreenshot',
    root: '.rozie-resizable',
    derived: { '--rozie-resizable-handle-active-bg': '--rozie-resizable-accent' },
    owned: ['--rozie-resizable-size'],
  },
  {
    family: 'slider',
    example: 'SliderBehavior',
    root: '.rozie-slider',
    derived: {
      '--rozie-slider-fill-bg': '--rozie-slider-accent',
      '--rozie-slider-thumb-bg': '--rozie-slider-accent',
      '--rozie-slider-bubble-bg': '--rozie-slider-accent',
    },
    owned: ['--rozie-slider-fill-start', '--rozie-slider-fill-end'],
  },
  { family: 'switch', example: 'SwitchBehavior', root: '.rozie-switch', derived: {} },
  { family: 'tags', example: 'TagsBehavior', root: '.rozie-tags', derived: {} },
  {
    family: 'toast',
    example: 'ToasterScreenshot',
    root: '.rozie-toaster',
    derived: { '--rozie-toast-info-bg': '--rozie-toast-bg' },
  },
];

/** First declaration of each `--rozie-*` name in the file (the light / default one). */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of noComments.matchAll(/(--rozie-[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    if (!out.has(m[1])) out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  }
  return out;
}

/** Every `--rozie-*` name base.css declares more than once (a dark-palette entry). */
function redeclared(css: string): string[] {
  const seen = new Map<string, number>();
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of noComments.matchAll(/(--rozie-[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([name]) => name);
}

const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

for (const fam of FAMILIES) {
  const css = readFileSync(resolve(UI, fam.family, 'src/themes/base.css'), 'utf8');
  const decls = declarations(css);

  for (const target of TARGETS) {
    const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
    const runner = !built ? test.fixme : test;

    const open = async (page: import('@playwright/test').Page) => {
      await page.goto(`/?example=${fam.example}&target=${target}`);
      await expect(page.locator(fam.root).first()).toBeAttached({ timeout: 15_000 });
      await page.addStyleTag({ content: css });
    };
    const readAll = (page: import('@playwright/test').Page, names: string[]) =>
      page.locator(fam.root).first().evaluate(
        (el, ns) => Object.fromEntries(ns.map((n) => [n, getComputedStyle(el).getPropertyValue(n).trim().replace(/\s+/g, ' ')])),
        names,
      );
    const setOnBody = (page: import('@playwright/test').Page, values: Record<string, string>) =>
      page.evaluate((vs) => {
        for (const [n, v] of Object.entries(vs)) document.body.style.setProperty(n, v);
      }, values);

    runner(`[${fam.family}] base.css defaults reach the component [${target}]`, async ({ page }) => {
      await open(page);
      const plain = [...decls].filter(([n, v]) => !v.includes('var(') && !CSS_WIDE.has(v) && !fam.owned?.includes(n));
      expect(plain.length).toBeGreaterThan(0);
      const got = await readAll(page, plain.map(([n]) => n));
      expect(got).toEqual(Object.fromEntries(plain));
    });

    runner(`[${fam.family}] a public token set on an ancestor wins over base.css [${target}]`, async ({ page }) => {
      await open(page);
      const names = [...new Set([...decls.keys(), ...Object.keys(fam.derived)])].filter((n) => !fam.owned?.includes(n));
      const sentinels = Object.fromEntries(names.map((n, i) => [n, `rz-ancestor-${i}`]));
      await setOnBody(page, sentinels);
      expect(await readAll(page, names)).toEqual(sentinels);
    });

    if (Object.keys(fam.derived).length) {
      runner(`[${fam.family}] a derived token follows its source set on an ancestor [${target}]`, async ({ page }) => {
        await open(page);
        const sources = [...new Set(Object.values(fam.derived))];
        const mark = (t: string) => `rz-src-${t.slice(2)}`;
        await setOnBody(page, Object.fromEntries(sources.map((s) => [s, mark(s)])));
        const got = await readAll(page, Object.keys(fam.derived));
        // Undeclared ('') → the component's read-site fallback resolves the source there;
        // declared → its value must have been computed against the ancestor's source. (A token
        // that is itself a source — date-picker's selected-bg — reads its own ancestor value.)
        for (const [tok, src] of Object.entries(fam.derived)) {
          const v = got[tok];
          const ok = v === '' || v.includes(mark(src)) || (sources.includes(tok) && v === mark(tok));
          expect(ok, `${tok} = "${v}"`).toBe(true);
        }
      });
    }

    if (fam.dark) {
      const [probe, darkValue] = fam.dark;
      const lightValue = decls.get(probe);
      const darkNames = redeclared(css);
      /** Mount under the given colour scheme / root class, optionally importing base.css. */
      const openAs = async (
        page: import('@playwright/test').Page,
        opts: { scheme: 'light' | 'dark'; rootClass?: string; base: boolean },
      ) => {
        await page.emulateMedia({ colorScheme: opts.scheme });
        await page.goto(`/?example=${fam.example}&target=${target}`);
        await expect(page.locator(fam.root).first()).toBeAttached({ timeout: 15_000 });
        if (opts.rootClass) {
          await page.evaluate((c) => document.documentElement.classList.add(c), opts.rootClass);
        }
        if (opts.base) await page.addStyleTag({ content: css });
      };

      runner(`[${fam.family}] the dark palette is still the default [${target}]`, async ({ page }) => {
        expect(darkNames.length).toBeGreaterThan(10);
        await openAs(page, { scheme: 'dark', base: false });
        expect((await readAll(page, [probe]))[probe], 'OS dark, nothing imported').toBe(darkValue);
        await openAs(page, { scheme: 'dark', base: true });
        expect((await readAll(page, [probe]))[probe], 'OS dark, base.css').toBe(darkValue);
        await openAs(page, { scheme: 'light', rootClass: 'dark', base: true });
        expect((await readAll(page, [probe]))[probe], '.dark root, base.css').toBe(darkValue);
      });

      runner(`[${fam.family}] a .light root still opts out of OS dark [${target}]`, async ({ page }) => {
        await openAs(page, { scheme: 'dark', rootClass: 'light', base: true });
        expect((await readAll(page, [probe]))[probe], 'base.css').toBe(lightValue);
        await openAs(page, { scheme: 'dark', rootClass: 'light', base: false });
        // Nothing imported: the token is unset and the read site's light fallback applies.
        expect((await readAll(page, [probe]))[probe], 'nothing imported').toBe('');
      });

      for (const mode of [
        { name: 'OS dark, nothing imported', scheme: 'dark', base: false },
        { name: 'OS dark, base.css', scheme: 'dark', base: true },
        { name: '.dark root, base.css', scheme: 'light', rootClass: 'dark', base: true },
      ] as const) {
        runner(`[${fam.family}] a dark-palette token set on an ancestor wins (${mode.name}) [${target}]`, async ({ page }) => {
          await openAs(page, mode);
          const sentinels = Object.fromEntries(darkNames.map((n, i) => [n, `rz-dark-ancestor-${i}`]));
          await setOnBody(page, sentinels);
          expect(await readAll(page, darkNames)).toEqual(sentinels);
        });
      }
    }
  }
}
