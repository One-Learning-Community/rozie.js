/**
 * panel-write-order.test.ts — pins the ORDER of the two writes in Select's
 * `syncPanel()`.
 *
 * Select's open state is bridged to the composed popover through a pair:
 * `$data.panelOpen` (bound to the popover's `open` model) and `$data.panelEcho` (the
 * last value Select itself wrote there). A pair that reads "panelOpen false, echo
 * true" is the shape a popover dismissal leaves, and the `panelEcho` watcher takes it
 * for one and calls `close()`.
 *
 * `syncPanel()` writes the pair in an order that never passes through that shape:
 *
 *   show:  panelOpen = true,  then panelEcho = true   (in between: open true, echo false)
 *   hide:  panelEcho = false, then panelOpen = false  (in between: open true, echo false)
 *
 * The order only matters where a watcher runs synchronously on the first write. That
 * is Lit: its props-only watcher calls `syncPanel()` from `updated()`, outside any
 * signal batch, so each write re-runs the signal effects at once. Reversed, the hide
 * branch reads "open false, echo true" between its two writes, and a `hideEmpty`
 * drain while open closed the select (`open-change` log `TF`) — reproduced by the
 * reviewer on a model built on real `@preact/signals-core`. The only other guard is
 * the Lit cell of the hideEmpty browser spec; this one fails without a browser.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const select = readFileSync(resolve(ROOT, 'src/Select.rozie'), 'utf8');

/** The text of the top-level `const <name> = () => {` … `}` (closing brace at column 0). */
const topLevelFunction = (src: string, name: string): string => {
  const head = `\nconst ${name} = `;
  const at = src.indexOf(head);
  if (at < 0) throw new Error(`no top-level const ${name}`);
  const end = src.indexOf('\n}', at + 1);
  if (end < 0) throw new Error(`no closing brace for ${name}`);
  return src.slice(at + 1, end + 2);
};

/** Every assignment to `$data.panelOpen` / `$data.panelEcho`, in source order (comments skipped). */
const pairWrites = (text: string): string[] =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .flatMap((line) => [...line.matchAll(/\$data\.(panelOpen|panelEcho)\s*=(?!=)\s*([^\n;]+)/g)])
    .map((m) => `${m[1]} = ${(m[2] ?? '').trim()}`);

describe('syncPanel() write order', () => {
  const body = topLevelFunction(select, 'syncPanel');

  it('shows the panel with panelOpen first, and hides it with panelEcho first', () => {
    expect(pairWrites(body)).toEqual([
      'panelOpen = true',
      'panelEcho = true',
      'panelEcho = false',
      'panelOpen = false',
    ]);
  });

  it('the show writes sit under `if (visible)` and the hide writes under its `else`', () => {
    const show = body.indexOf('if (visible) {');
    const hide = body.indexOf('} else {', show);
    expect(show).toBeGreaterThan(-1);
    expect(hide).toBeGreaterThan(show);
    expect(pairWrites(body.slice(show, hide))).toEqual(['panelOpen = true', 'panelEcho = true']);
    expect(pairWrites(body.slice(hide))).toEqual(['panelEcho = false', 'panelOpen = false']);
  });

  it('nothing else writes the pair except takePanelWrite (which only copies panelOpen into panelEcho)', () => {
    expect(pairWrites(select)).toEqual([
      'panelOpen = true',
      'panelEcho = true',
      'panelEcho = false',
      'panelOpen = false',
      'panelEcho = $data.panelOpen',
    ]);
    expect(pairWrites(topLevelFunction(select, 'takePanelWrite'))).toEqual(['panelEcho = $data.panelOpen']);
  });
});
