/**
 * litEventMap — typed public surface P1 (Lit). The ONE place the Lit target
 * derives its typed-event surface from `ir.emitDecls`, shared by the compiled
 * module (emitLit / emitScript / the two `$emit` dispatch lowerings) and the
 * `.d.rozie.ts` sidecar (emitTypes), so the two cannot drift:
 *
 *   - `declaredPayloadType(ir, name)` — the authored payload for a dispatch's
 *     `new CustomEvent<P>(…)` type argument (type-only).
 *   - `renderLitEventMap(ir)` — `export interface Rozie<Name>EventMap extends
 *     Omit<HTMLElementEventMap, '<declared keys>'> { '<kebab>': CustomEvent<P>;
 *     … }` at module scope. Keys use the SAME `kebabize` the dispatch uses. The
 *     `Omit` makes any DOM-name collision (`select`, `click`, `toggle`, …) a
 *     replacement rather than an incompatible override (no TS2430). Every
 *     `model: true` prop also contributes its `<kebab-prop>-change` event (the
 *     name the controllable-property runtime dispatches), typed with the prop's
 *     own TS type — the two-way model's change event is part of the typed
 *     surface too (release-0.8.0 audit B6: Popover's only change signal).
 *   - `renderLitListenerOverloads(ir, mode)` — typed `addEventListener` /
 *     `removeEventListener` overloads. `'class'` appends an implementation that
 *     is a behaviour-identical `super` pass-through (the single allowed
 *     runtime-visible addition); `'declare'` is declaration-only (sidecar).
 *
 * Every helper returns `''` / `null` when `ir.emitDecls == null`, so a
 * component without `<emits>` stays byte-identical.
 *
 * @experimental — added in typed-surface P1
 */
import * as t from '@babel/types';
import type { IRComponent } from '@rozie/core';
import { indentContinuation, printTSType } from '@rozie/core';
import { kebabize } from './resolveLitSetterText.js';
import { toKebabCase } from './emitDecorator.js';
import { renderTsType } from './emitScript.js';
import { litEventMapName as coreLitEventMapName } from '../../../../core/src/codegen/generatedTypeNames.js';

/** `Rozie<Name>EventMap` — the exported event-map interface name. */
export function litEventMapName(ir: IRComponent): string {
  return coreLitEventMapName(ir.name);
}

/**
 * The declared payload type for `$emit('<name>', …)`, cloned for placement as
 * `new CustomEvent<P>(…)`'s type argument; `null` when there is no `<emits>`
 * block, the event is undeclared, or it declares no payload.
 */
export function declaredPayloadType(ir: IRComponent, name: string): t.TSType | null {
  if (ir.emitDecls == null) return null;
  const decl = ir.emitDecls.find((d) => d.name === name);
  return decl?.payload ? t.cloneNode(decl.payload, true) : null;
}

/** `new CustomEvent<P>(…)` — attach the declared payload (type-only). */
export function typeCustomEventDispatch(
  ir: IRComponent,
  name: string,
  newExpr: t.NewExpression,
): void {
  const payload = declaredPayloadType(ir, name);
  if (payload !== null) newExpr.typeParameters = t.tsTypeParameterInstantiation([payload]);
}

/** The module-scope event-map interface; `''` without `<emits>`. */
export function renderLitEventMap(ir: IRComponent): string {
  if (ir.emitDecls == null) return '';
  const keys = ir.emitDecls.map((d) => `'${kebabize(d.name)}'`);
  const members = ir.emitDecls.map((d, i) => {
    const payload = d.payload ? indentContinuation(printTSType(d.payload)) : 'undefined';
    return `  ${keys[i]}: CustomEvent<${payload}>;`;
  });
  // Model change events — same name as emitScript's controllable property
  // (`${toKebabCase(prop.name)}-change`). A declared emit of the same name wins.
  for (const p of ir.props) {
    if (!p.isModel) continue;
    const key = `'${toKebabCase(p.name)}-change'`;
    if (keys.includes(key)) continue;
    keys.push(key);
    members.push(`  ${key}: CustomEvent<${renderTsType(p.typeAnnotation)}>;`);
  }
  // `Omit` the declared keys first: a declared name that collides with a DOM
  // event whose map type is NOT plain `Event` (`click` → PointerEvent, `focus`
  // → FocusEvent, `toggle` → ToggleEvent, …) would otherwise be an incompatible
  // override (TS2430). Every other DOM event stays inherited.
  return `export interface ${litEventMapName(ir)} extends Omit<HTMLElementEventMap, ${keys.length > 0 ? keys.join(' | ') : 'never'}> {\n${members.join('\n')}\n}`;
}

/**
 * Typed listener overloads, 2-space indented for a class body; `''` without
 * `<emits>`. `mode: 'class'` adds the `super` pass-through implementations.
 */
export function renderLitListenerOverloads(ir: IRComponent, mode: 'class' | 'declare'): string {
  if (ir.emitDecls == null) return '';
  const map = litEventMapName(ir);
  const cls = ir.name;
  const opts = (kind: 'Add' | '') => `options?: boolean | ${kind}EventListenerOptions`;
  const lines: string[] = [];
  for (const [method, kind] of [
    ['addEventListener', 'Add'],
    ['removeEventListener', ''],
  ] as const) {
    const plain = `${method}(type: string, listener: EventListenerOrEventListenerObject, ${opts(kind)}): void`;
    lines.push(
      `  ${method}<K extends keyof ${map}>(type: K, listener: (this: ${cls}, ev: ${map}[K]) => any, ${opts(kind)}): void;`,
    );
    lines.push(`  ${plain};`);
    if (mode === 'class') {
      lines.push(`  ${plain} {\n    super.${method}(type, listener, options);\n  }`);
    }
  }
  return lines.join('\n');
}
