import { test, expect, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));
const UI = resolve(__dirname, '../../../packages/ui');
const theme = (family: string, name: string) => readFileSync(resolve(UI, family, `src/themes/${name}.css`), 'utf8');

/**
 * Select and Combobox are one design system: with the same tokens, in the same theme, their
 * controls, chips, option rows, popup surface, group headings, empty state and disabled state
 * must compute to the same styles. Compared BY COMPUTED STYLE (examples/demos/SelectScreenshotDemo
 * renders both families side by side) under the default tokens, with each family's base.css
 * imported, and under each of the three design-system bridges with distinctive design-system
 * variables set on the document root.
 *
 * What is deliberately NOT compared, because the families legitimately differ: the control's
 * height (Select's trigger is a div with a minimum line, Combobox's is a text input); the
 * selected option's colour (Select shows a check mark, Combobox tints the label). The
 * placeholder IS compared: Combobox styles none, so it renders the browser's `::placeholder`
 * colour, and Select's placeholder must be the same colour. The focus state (border, ring) and
 * the horizontal gap between two chips are compared as well.
 *
 * Behavioral-only (no screenshot baseline).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

interface Mode { name: string; css: string[]; vars: Record<string, string> }
const both = (file: string) => [theme('select', file), theme('combobox', file)];
const MODES: Mode[] = [
  { name: 'default tokens', css: [], vars: {} },
  { name: 'base.css imported', css: both('base'), vars: {} },
  {
    name: 'shadcn bridge',
    css: [...both('base'), ...both('shadcn')],
    vars: {
      '--background': '210 40% 98%', '--foreground': '10 50% 20%', '--border': '30 60% 50%', '--radius': '1rem',
      '--primary': '280 60% 40%', '--ring': '100 50% 50%', '--muted': '20 30% 90%', '--popover': '40 50% 95%',
      '--accent': '200 50% 85%', '--muted-foreground': '0 0% 40%',
    },
  },
  {
    name: 'material bridge',
    css: [...both('base'), ...both('material')],
    vars: {
      '--md-sys-color-surface': '#f6fff0', '--md-sys-color-on-surface': '#102010', '--md-sys-color-outline': '#336633',
      '--md-sys-color-outline-variant': '#99cc99', '--md-sys-color-primary': '#aa2255',
      '--md-sys-color-surface-container': '#e8f5e0', '--md-sys-color-surface-container-highest': '#d0e8c8',
    },
  },
  {
    name: 'bootstrap bridge',
    css: [...both('base'), ...both('bootstrap')],
    vars: {
      '--bs-body-bg': '#fffbe6', '--bs-body-color': '#332200', '--bs-border-color': '#cc9933', '--bs-border-radius': '0.9rem',
      '--bs-primary': '#117744', '--bs-primary-rgb': '17, 119, 68', '--bs-tertiary-bg': '#f0e6c8',
    },
  },
];

const CONTROL = ['border-top-color', 'border-top-width', 'border-top-left-radius', 'background-color', 'color', 'font-size', 'font-family', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'width'];
const CHIP = ['background-color', 'border-top-left-radius', 'font-size', 'color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
const CHIP_REMOVE = ['width', 'height', 'border-top-left-radius', 'color'];
const LIST = ['background-color', 'color', 'border-top-color', 'border-top-width', 'border-top-left-radius', 'box-shadow', 'padding-top', 'padding-left', 'max-height'];
const OPTION = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-left-radius', 'color', 'font-size', 'background-color'];
const GROUP_HEADING = ['font-size', 'font-weight', 'color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'letter-spacing', 'text-transform', 'margin-top'];
const EMPTY = ['padding-top', 'padding-left', 'color', 'font-size'];

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = !built ? test.fixme : test;

  for (const mode of MODES) {
    runner(`select-screenshot [${target}] [${mode.name}]: select and combobox share computed styling`, async ({ page }) => {
      await page.goto(`/?example=SelectScreenshot&target=${target}`);
      await expect(page.getByTestId('cb-single').locator('.rozie-combobox-input')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('sel-single').locator('.rozie-select-control')).toBeVisible();
      for (const css of mode.css) await page.addStyleTag({ content: css });
      await page.evaluate((vars) => {
        for (const [n, v] of Object.entries(vars)) document.documentElement.style.setProperty(n, v);
      }, mode.vars);

      // Let the Combobox input's `transition: border-color` finish before anything is read.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      await page.waitForTimeout(300);

      const mismatches: string[] = [];
      // The Combobox's `color` token styles its input only: its chips, popup, options and empty row
      // inherit the page colour, so a bridge's text colour reaches them in Select (which sets the
      // colour on the control and the list) but not in Combobox. Compared where both inherit.
      const bridged = mode.name.endsWith('bridge');
      const textColor = (props: string[]) => (bridged ? props.filter((p) => p !== 'color') : props);
      const read = (loc: Locator, props: string[]) =>
        loc.first().evaluate((el, ps) => { const cs = getComputedStyle(el); return ps.map((k) => cs.getPropertyValue(k)); }, props);
      const compare = async (label: string, sel: Locator, cbx: Locator, props: string[]) => {
        const a = await read(sel, props);
        const b = await read(cbx, props);
        props.forEach((p, i) => { if (a[i] !== b[i]) mismatches.push(`${label}.${p}: select=${a[i]} combobox=${b[i]}`); });
      };
      const sel = (id: string, css: string) => page.getByTestId(`sel-${id}`).locator(css);
      const cbx = (id: string, css: string) => page.getByTestId(`cb-${id}`).locator(css);

      // controls: the Combobox draws its border on the input (stacked layout)
      await compare('control (block)', sel('single', '.rozie-select-control'), cbx('single', '.rozie-combobox-input'), CONTROL);
      await compare('control (default width)', sel('plain', '.rozie-select-control'), cbx('plain', '.rozie-combobox-input'), ['width', 'border-top-left-radius']);
      await compare('control (multi)', sel('multi', '.rozie-select-control'), cbx('multi', '.rozie-combobox-input'), CONTROL.filter((p) => p !== 'width'));

      // chips
      await compare('chip', sel('multi', '.rozie-select-chip'), cbx('multi', '.rozie-combobox-chip'), textColor(CHIP));
      await compare('chip remove', sel('multi', '.rozie-select-chip__remove'), cbx('multi', '.rozie-combobox-chip__remove'), textColor(CHIP_REMOVE));

      // disabled: the opacity sits on the Select root and on the Combobox input; both draw the disabled background
      await compare('disabled opacity', sel('off', '.rozie-select-disabled'), cbx('off', '.rozie-combobox-input'), ['opacity']);
      await compare('disabled control', sel('off', '.rozie-select-control'), cbx('off', '.rozie-combobox-input'), ['background-color', 'border-top-color']);

      // placeholder: Combobox styles none (browser default ::placeholder), Select has a token
      const selPh = await sel('plain', '.rozie-select-placeholder').first().evaluate((el) => getComputedStyle(el).color);
      const cbPh = await cbx('plain', '.rozie-combobox-input').first().evaluate((el) => getComputedStyle(el, '::placeholder').color);
      if (selPh !== cbPh) mismatches.push(`placeholder.color: select=${selPh} combobox=${cbPh}`);

      // chip spacing: the horizontal distance between two adjacent chips
      const chipGap = async (chips: Locator) => {
        const a = await chips.nth(0).boundingBox();
        const b = await chips.nth(1).boundingBox();
        return a && b ? Math.round((b.x - (a.x + a.width)) * 100) / 100 : NaN;
      };
      const selChipGap = await chipGap(sel('multi', '.rozie-select-chip'));
      const cbChipGap = await chipGap(cbx('multi', '.rozie-combobox-chip'));
      if (selChipGap !== cbChipGap) mismatches.push(`chip spacing: select=${selChipGap} combobox=${cbChipGap}`);

      // focus state: ring and border (the Combobox draws them on the focused input, Select on :focus-within)
      const FOCUS = ['box-shadow', 'border-top-color', 'outline-style', 'outline-width'];
      const settle = async () => {
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
        await page.waitForTimeout(300);
      };
      await sel('plain', '[role="combobox"]').first().focus();
      await settle();
      const selFocus = await read(sel('plain', '.rozie-select-control'), FOCUS);
      await cbx('plain', '.rozie-combobox-input').first().focus();
      await settle();
      const cbFocus = await read(cbx('plain', '.rozie-combobox-input'), FOCUS);
      FOCUS.forEach((p, i) => { if (selFocus[i] !== cbFocus[i]) mismatches.push(`focus.${p}: select=${selFocus[i]} combobox=${cbFocus[i]}`); });
      await page.mouse.click(0, 0);

      // open both multi popups in turn; move the highlight off the selected options
      const openSelect = async (id: string) => {
        await sel(id, '[role="combobox"]').first().click();
        await expect(sel(id, '.rozie-select-list').first()).toBeVisible();
        await page.mouse.move(0, 0);
      };
      const openCombobox = async (id: string) => {
        await cbx(id, '.rozie-combobox-input').first().click();
        await expect(cbx(id, '.rozie-combobox-list').first()).toBeVisible();
        await page.mouse.move(0, 0);
      };
      const highlight = async (pressTarget: Locator, active: Locator) => {
        // one key at a time, waiting for the highlight to render (Angular renders a tick late)
        for (let i = 0; i < 8; i++) {
          await pressTarget.press('ArrowDown');
          if (await active.first().waitFor({ state: 'visible', timeout: 400 }).then(() => true, () => false)) return;
        }
        await expect(active.first()).toBeVisible();
      };
      const close = async (loc: Locator, list: Locator) => {
        await loc.press('Escape');
        await expect(list).toHaveCount(0);
      };

      const selTrigger = sel('multi', '[role="combobox"]').first();
      const cbInput = cbx('multi', '.rozie-combobox-input').first();
      await openSelect('multi');
      await highlight(selTrigger, sel('multi', '.rozie-select-option.is-active:not(.is-selected)'));
      const selList = await read(sel('multi', '.rozie-select-list'), LIST);
      const selOpt = await read(sel('multi', '.rozie-select-option:not(.is-active):not(.is-selected):not(.is-disabled)'), OPTION);
      const selActive = await read(sel('multi', '.rozie-select-option.is-active:not(.is-selected)'), OPTION);
      const selHead = await read(sel('multi', '.rozie-select-group-heading'), GROUP_HEADING);
      await close(selTrigger, sel('multi', '.rozie-select-list'));

      await openCombobox('multi');
      await highlight(cbInput, cbx('multi', '.rozie-combobox-option--active:not(.rozie-combobox-option--selected)'));
      const cbList = await read(cbx('multi', '.rozie-combobox-list'), LIST);
      const cbOpt = await read(cbx('multi', '.rozie-combobox-option:not(.rozie-combobox-option--active):not(.rozie-combobox-option--selected):not(.rozie-combobox-option--disabled)'), OPTION);
      const cbActive = await read(cbx('multi', '.rozie-combobox-option--active:not(.rozie-combobox-option--selected)'), OPTION);
      const cbHead = await read(cbx('multi', '.rozie-combobox-group-heading'), GROUP_HEADING);
      await close(cbInput, cbx('multi', '.rozie-combobox-list'));

      const diff = (label: string, props: string[], a: string[], b: string[]) =>
        props.forEach((p, i) => { if (a[i] !== b[i]) mismatches.push(`${label}.${p}: select=${a[i]} combobox=${b[i]}`); });
      const listProps = textColor(LIST);
      const pick = (props: string[], all: string[], vals: string[]) => props.map((p) => vals[all.indexOf(p)]!);
      diff('popup surface', listProps, pick(listProps, LIST, selList), pick(listProps, LIST, cbList));
      const optProps = textColor(OPTION);
      diff('option row', optProps, pick(optProps, OPTION, selOpt), pick(optProps, OPTION, cbOpt));
      diff('active option', optProps, pick(optProps, OPTION, selActive), pick(optProps, OPTION, cbActive));
      diff('group heading', GROUP_HEADING, selHead, cbHead);

      // empty state
      await sel('none', '[role="combobox"]').first().click();
      await expect(sel('none', '.rozie-select-empty').first()).toBeVisible();
      const selEmpty = await read(sel('none', '.rozie-select-empty'), textColor(EMPTY));
      await close(sel('none', '[role="combobox"]').first(), sel('none', '.rozie-select-list'));
      await cbx('none', '.rozie-combobox-input').first().click();
      await expect(cbx('none', '.rozie-combobox-empty').first()).toBeVisible();
      diff('empty state', textColor(EMPTY), selEmpty, await read(cbx('none', '.rozie-combobox-empty'), textColor(EMPTY)));

      expect(mismatches).toEqual([]);
    });
  }
}
