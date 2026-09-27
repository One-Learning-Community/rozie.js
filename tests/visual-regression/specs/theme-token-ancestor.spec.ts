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
 * Two more per design-system bridge the family ships (themes/shadcn.css, material.css,
 * bootstrap.css), each imported after base.css:
 *  4. every token the bridge maps, set on an ANCESTOR, still wins at the component;
 *  5. the design system's variables set on a WRAPPER (the component's parent — the host's on
 *     Lit) and nowhere else re-skin the component: the bridge resolves them at the component,
 *     so a `.dark` / `data-bs-theme` scope narrower than <html> is followed.
 * What the component resolves is PROBED, not read off the public token: the component's own
 * read-site var() chain for the token is evaluated on its root element. A bridge that maps
 * through a private wiring layer is visible only that way.
 *
 * Families with a built-in dark palette (rete: FlowCanvas ships an OS-driven dark default in
 * its own SFC, and base.css adds the `.dark` / `[data-theme="dark"]` class strategy) get four
 * more cases: the dark palette is still the default (OS dark with nothing imported; a `.dark`
 * root with base.css), a `.light` root still opts out, and under OS dark or a `.dark` root
 * every dark-palette token set on an ancestor wins — with and without base.css.
 *
 * Behavioral-only (no pixel baseline).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  /** The Lit leaf's custom-element tag, when a bare instance renders `root` with no props
   * (measures a bridge on a Lit host in the document's light DOM). */
  litTag?: string;
  /** Attributes the bare Lit instance needs to render `root` (a palette must be open). */
  litAttrs?: Record<string, string>;
  /** A token and its dark-palette value, when the family ships a dark default. */
  dark?: [string, string];
}

const FAMILIES: Family[] = [
  {
    family: 'combobox', litTag: 'rozie-combobox',
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
    family: 'command-palette', litTag: 'rozie-command-palette', litAttrs: { open: '' },
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
    family: 'date-picker', litTag: 'rozie-date-picker',
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
  { family: 'dialog', litTag: 'rozie-dialog', example: 'DialogScreenshot', root: '.rozie-dialog', derived: {} },
  {
    family: 'embla', litTag: 'rozie-carousel',
    example: 'Carousel',
    root: '.rozie-embla',
    derived: {
      '--rozie-embla-arrow-fg': '--rozie-embla-accent',
      '--rozie-embla-dot-selected-bg': '--rozie-embla-accent',
      '--rozie-embla-thumb-selected-border-color': '--rozie-embla-accent',
    },
  },
  {
    family: 'listbox', litTag: 'rozie-listbox',
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
  { family: 'number-field', litTag: 'rozie-number-field', example: 'NumberFieldBehavior', root: '.rozie-number-field', derived: {} },
  {
    family: 'otp', litTag: 'rozie-otp',
    example: 'OtpBehavior',
    root: '.rozie-otp',
    derived: { '--rozie-otp-filled-border-color': '--rozie-otp-accent' },
  },
  {
    family: 'pagination', litTag: 'rozie-pagination',
    example: 'PaginationBehavior',
    root: '.rozie-pagination',
    derived: {
      '--rozie-pagination-active-bg': '--rozie-pagination-accent',
      '--rozie-pagination-active-border': '--rozie-pagination-accent',
      '--rozie-pagination-ring': '--rozie-pagination-accent',
    },
  },
  { family: 'popover', litTag: 'rozie-popover', example: 'PopoverScreenshot', root: '.rozie-popover', derived: {} },
  {
    family: 'rete', litTag: 'rozie-flow-canvas',
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
    family: 'resizable', litTag: 'rozie-resizable',
    example: 'ResizableScreenshot',
    root: '.rozie-resizable',
    derived: { '--rozie-resizable-handle-active-bg': '--rozie-resizable-accent' },
    owned: ['--rozie-resizable-size'],
  },
  {
    family: 'slider', litTag: 'rozie-slider',
    example: 'SliderBehavior',
    root: '.rozie-slider',
    derived: {
      '--rozie-slider-fill-bg': '--rozie-slider-accent',
      '--rozie-slider-thumb-bg': '--rozie-slider-accent',
      '--rozie-slider-bubble-bg': '--rozie-slider-accent',
    },
    owned: ['--rozie-slider-fill-start', '--rozie-slider-fill-end'],
  },
  { family: 'switch', litTag: 'rozie-switch', example: 'SwitchBehavior', root: '.rozie-switch', derived: {} },
  {
    family: 'tags', litTag: 'rozie-tags', example: 'TagsBehavior', root: '.rozie-tags', derived: {},
    dark: ['--rozie-tags-bg', '#1e293b'],
  },
  {
    family: 'toast', litTag: 'rozie-toaster',
    example: 'ToasterScreenshot',
    root: '.rozie-toaster',
    derived: { '--rozie-toast-info-bg': '--rozie-toast-bg' },
  },
];

/** Index of the `)` closing the `(` that precedes `from`, parens balanced; -1 if none. */
function closeParen(text: string, from: number): number {
  let depth = 1;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/** `var(--name, <fallback>)` spanning the whole value → [name, fallback]. */
function wiring(value: string): [string, string] | undefined {
  const m = /^var\((--rozie-[a-z0-9-]+)\s*,/.exec(value);
  if (!m || closeParen(value, 4) !== value.length - 1) return undefined;
  return [m[1]!, value.slice(m[0].length, -1).trim()];
}

/**
 * The public token → default each rule of the file gives, first occurrence (the light /
 * default one): a declaration of the token itself, or a WIRING line — a private custom
 * property whose value is `var(--rozie-…, <default>)` (the data-table design: the stylesheet
 * declares no public token, so a value set on any ancestor wins by inheritance).
 */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of noComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    const value = m[2]!.trim().replace(/\s+/g, ' ');
    const name = m[1]!;
    const pair: [string, string] | undefined = name.startsWith('--rozie-') ? [name, value] : wiring(value);
    if (pair && !out.has(pair[0])) out.set(pair[0], pair[1]);
  }
  return out;
}

/** Every DESIGN-SYSTEM variable a bridge reads (any `var(--x` that is not a Rozie token). */
function designSystemVars(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...new Set([...noComments.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!))].filter(
    (n) => !n.startsWith('--rozie-'),
  );
}

/**
 * For each public token, the first var() chain in the component's own <style> that reads it
 * FIRST (`var(--rozie-x-ring, var(--rozie-x-accent, …))` for ring). Probing that exact
 * expression on the component element measures what the component resolves there, not
 * merely what the public token inherits — a bridge that re-skins through a private layer is
 * only visible this way.
 */
function readChains(familyDir: string, prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  const srcDir = resolve(familyDir, 'src');
  for (const f of readdirSync(srcDir).filter((n) => n.endsWith('.rozie')).sort()) {
    const src = readFileSync(resolve(srcDir, f), 'utf8');
    for (const block of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const css = block[1]!.replace(/\/\*[\s\S]*?\*\//g, '');
      let i = 0;
      for (;;) {
        const at = css.indexOf(`var(${prefix}`, i);
        if (at === -1) break;
        const end = closeParen(css, at + 4);
        if (end === -1) break;
        const expr = css.slice(at, end + 1).replace(/\s+/g, ' ');
        const name = /^var\((--[a-z0-9-]+)/.exec(expr)?.[1];
        if (name && !out.has(name)) out.set(name, expr);
        i = end + 1;
      }
      // A token only ever read as a FALLBACK (the accent behind `var(--x-ring, var(--x-accent,
      // …))`): probe the sub-chain that starts at it.
      for (const m of css.matchAll(new RegExp(`var\\((${prefix}[a-z0-9-]+)`, 'g'))) {
        const end = closeParen(css, m.index + 4);
        if (end !== -1 && !out.has(m[1]!)) out.set(m[1]!, css.slice(m.index, end + 1).replace(/\s+/g, ' '));
      }
    }
  }
  return out;
}

function commonPrefix(names: string[]): string {
  let p = names[0] ?? '';
  for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
  return p.slice(0, p.lastIndexOf('-') + 1);
}

const BRIDGES = ['shadcn', 'material', 'bootstrap'] as const;

/**
 * Every public token base.css gives a value more than once (a dark-palette entry): counted
 * through its wiring line, and through a plain declaration of the private name that line
 * wires it to (`--rfc-bg: var(--rozie-flow-bg, …)` makes `--rfc-bg: #0f172a` a `--rozie-flow-bg`
 * entry).
 */
function redeclared(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = [...noComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)].map(
    (m) => [m[1]!, m[2]!.trim()] as const,
  );
  const privateToPublic = new Map<string, string>();
  for (const [name, value] of decls) {
    const w = wiring(value);
    if (w && !name.startsWith('--rozie-')) privateToPublic.set(name, w[0]);
  }
  const seen = new Map<string, number>();
  for (const [name] of decls) {
    const pub = name.startsWith('--rozie-') ? name : privateToPublic.get(name);
    if (pub) seen.set(pub, (seen.get(pub) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([name]) => name);
}

const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

for (const fam of FAMILIES) {
  const css = readFileSync(resolve(UI, fam.family, 'src/themes/base.css'), 'utf8');
  const decls = declarations(css);
  const prefix = commonPrefix([...decls.keys()]);
  const chains = readChains(resolve(UI, fam.family), prefix);
  // A token the component reads only from script (rete's minimap colours, via
  // getComputedStyle): resolve it the way that script does — public token, then the private
  // name base.css wires it to.
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    const w = wiring(m[2]!.trim());
    if (w && !m[1]!.startsWith('--rozie-') && !chains.has(w[0])) chains.set(w[0], `var(${w[0]}, var(${m[1]}))`);
  }
  const bridges = BRIDGES.map((name) => {
    const path = resolve(UI, fam.family, `src/themes/${name}.css`);
    return existsSync(path) ? { name, css: readFileSync(path, 'utf8') } : undefined;
  }).filter((b) => b !== undefined);

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
    /** What the component resolves for each token at its root element: the read-site chain
     * evaluated there (a scratch custom property set inline), else the token itself. */
    const resolveAll = (page: import('@playwright/test').Page, names: string[]) =>
      page.locator(fam.root).first().evaluate(
        (el, pairs) => {
          const h = el as HTMLElement;
          const norm = (v: string) => v.trim().replace(/\s+/g, ' ');
          return Object.fromEntries(
            pairs.map(([n, expr]) => {
              if (!expr) return [n, norm(getComputedStyle(h).getPropertyValue(n))];
              h.style.setProperty('--rz-probe', expr);
              const v = norm(getComputedStyle(h).getPropertyValue('--rz-probe'));
              h.style.removeProperty('--rz-probe');
              return [n, v];
            }),
          );
        },
        names.map((n) => [n, chains.get(n) ?? ''] as [string, string]),
      );

    runner(`[${fam.family}] base.css defaults reach the component [${target}]`, async ({ page }) => {
      await open(page);
      const plain = [...decls].filter(([n, v]) => !v.includes('var(') && !CSS_WIDE.has(v) && !fam.owned?.includes(n));
      expect(plain.length).toBeGreaterThan(0);
      const got = await resolveAll(page, plain.map(([n]) => n));
      expect(got).toEqual(Object.fromEntries(plain));
    });

    runner(`[${fam.family}] a public token set on an ancestor wins over base.css [${target}]`, async ({ page }) => {
      await open(page);
      const names = [...new Set([...decls.keys(), ...Object.keys(fam.derived)])].filter((n) => !fam.owned?.includes(n));
      const sentinels = Object.fromEntries(names.map((n, i) => [n, `rz-ancestor-${i}`]));
      await setOnBody(page, sentinels);
      expect(await resolveAll(page, names)).toEqual(sentinels);
    });

    for (const bridge of bridges) {
      const bridged = [...declarations(bridge.css)].filter(([n]) => !fam.owned?.includes(n) && chains.has(n));
      const openWithBridge = async (page: import('@playwright/test').Page) => {
        await open(page);
        await page.addStyleTag({ content: bridge.css });
      };

      runner(`[${fam.family}] a public token set on an ancestor wins with the ${bridge.name} bridge imported [${target}]`, async ({ page }) => {
        expect(bridged.length).toBeGreaterThan(0);
        await openWithBridge(page);
        const sentinels = Object.fromEntries(bridged.map(([n], i) => [n, `rz-ancestor-${i}`]));
        await setOnBody(page, sentinels);
        expect(await resolveAll(page, Object.keys(sentinels))).toEqual(sentinels);
      });

      runner(`[${fam.family}] a ${bridge.name} theme scoped to a wrapper re-skins the component [${target}]`, async ({ page }) => {
        const dsVars = designSystemVars(bridge.css);
        const themed = bridged.filter(([, v]) => dsVars.some((d) => v.includes(`var(${d}`))).map(([n]) => n);
        expect(themed.length).toBeGreaterThan(0);
        await openWithBridge(page);
        // The design system's variables, set on the component's parent (on Lit, the host's)
        // and nowhere else — a `.dark` / `data-bs-theme` wrapper narrower than <html>. The Lit
        // demo renders its host inside the demo's OWN shadow root, where no document selector
        // reaches it: there the bridge's `:root` copy applies, and the design system's
        // variables are read at the document root (the documented limit), so they are set on
        // <html>. The next case covers a Lit host in the document's light DOM.
        await page.locator(fam.root).first().evaluate((el, vars) => {
          const host = (el.getRootNode() as ShadowRoot).host as HTMLElement | undefined;
          const nested = host !== undefined && host.getRootNode() !== document;
          const wrapper = nested ? document.documentElement : ((host ?? el).parentElement as HTMLElement);
          vars.forEach((d, i) => wrapper.style.setProperty(d, `rz-ds-${i}`));
        }, dsVars);
        const got = await resolveAll(page, themed);
        const missed = themed.filter((n) => !got[n]?.includes('rz-ds-')).map((n) => `${n} = "${got[n]}"`);
        expect(missed).toEqual([]);
      });

      if (target === 'lit' && fam.litTag) {
        const tag = fam.litTag;
        runner(`[${fam.family}] a ${bridge.name} theme scoped to a wrapper re-skins a light-DOM Lit host [${target}]`, async ({ page }) => {
          const dsVars = designSystemVars(bridge.css);
          const themed = bridged.filter(([, v]) => dsVars.some((d) => v.includes(`var(${d}`))).map(([n]) => n);
          await openWithBridge(page);
          // A <${tag}> placed straight in the document, under a wrapper that carries the design
          // system's variables: the bridge's host rule resolves them at the host.
          await page.evaluate(
            ({ t, vars, attrs }) => {
              const wrap = document.createElement('div');
              wrap.id = 'rz-ds-wrapper';
              vars.forEach((d, i) => wrap.style.setProperty(d, `rz-ds-${i}`));
              const host = document.createElement(t);
              for (const [a, v] of Object.entries(attrs)) host.setAttribute(a, v);
              wrap.appendChild(host);
              document.body.appendChild(wrap);
            },
            { t: tag, vars: dsVars, attrs: fam.litAttrs ?? {} },
          );
          const el = page.locator(`#rz-ds-wrapper ${tag} ${fam.root}`).first();
          await expect(el).toBeAttached({ timeout: 10_000 });
          const got = await el.evaluate(
            (node, pairs) => {
              const h = node as HTMLElement;
              return Object.fromEntries(
                pairs.map(([n, expr]) => {
                  h.style.setProperty('--rz-probe', expr);
                  const v = getComputedStyle(h).getPropertyValue('--rz-probe').trim();
                  h.style.removeProperty('--rz-probe');
                  return [n, v];
                }),
              );
            },
            themed.map((n) => [n, chains.get(n)!] as [string, string]),
          );
          const missed = themed.filter((n) => !got[n]?.includes('rz-ds-')).map((n) => `${n} = "${got[n]}"`);
          expect(missed).toEqual([]);
        });
      }
    }

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
          const v = got[tok] ?? '';
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
        expect((await resolveAll(page, [probe]))[probe], 'OS dark, nothing imported').toBe(darkValue);
        await openAs(page, { scheme: 'dark', base: true });
        expect((await resolveAll(page, [probe]))[probe], 'OS dark, base.css').toBe(darkValue);
        await openAs(page, { scheme: 'light', rootClass: 'dark', base: true });
        expect((await resolveAll(page, [probe]))[probe], '.dark root, base.css').toBe(darkValue);
      });

      runner(`[${fam.family}] a .light root still opts out of OS dark [${target}]`, async ({ page }) => {
        await openAs(page, { scheme: 'dark', rootClass: 'light', base: true });
        expect((await resolveAll(page, [probe]))[probe], 'base.css').toBe(lightValue);
        await openAs(page, { scheme: 'dark', rootClass: 'light', base: false });
        // Nothing imported: the read site's own light fallback applies.
        expect((await resolveAll(page, [probe]))[probe], 'nothing imported').toBe(lightValue);
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
          expect(await resolveAll(page, darkNames)).toEqual(sentinels);
        });
      }
    }
  }
}
