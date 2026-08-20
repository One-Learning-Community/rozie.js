# @rozie/runtime-angular

Runtime helpers shared by Rozie-emitted Angular components. Every export is
consumed by generated `.ts` files, not typically imported by hand — see each
section below for the emission condition that gates it.

- `RozieSlot` — the marker directive a producer collects, via
  `contentChildren`, to resolve record-path slot fills.
- `rozieDisplay` / `rozieAttr` — interpolation / whole-value-attribute
  display helpers.
- `rozieToken` — the `$provide`/`$inject` context `InjectionToken` registry.
- `createRozieAttrApplier` / `createRozieHostAttrsReader` — the `r-bind` /
  `$attrs` spread attribute applier and host-attribute reader factories
  (Tier 2, Quick task 260819-sg9). See "Attribute spread factories" below.

## `RozieSlot`

What a Rozie-emitted Angular producer collects, via `contentChildren`, to
resolve record-path slot fills: dynamic `#[expr]` slots, non-identifier
static `#cell-status` slots, and matched-family slots (e.g. a data-table's
per-column templates).

Identifier-named static slot fills do NOT need this package — those keep the
`@ContentChild('headerCell', { read: TemplateRef })` path unchanged.

## Status

Shipped. Built partial-Ivy via `ng-packagr`, forward-compatible across the
declared `@angular/core` `^19 || ^20 || ^21` peer range.

## Install

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/runtime-angular": "workspace:*"
  },
  "peerDependencies": {
    "@angular/core": "^19 || ^20 || ^21"
  }
}
```

A component with no record-path slot fills never imports this package — the
emitted import is conditional on the producer actually declaring a
record-path slot.

## Usage

You normally do not import `RozieSlot` by hand — `@rozie/target-angular`
injects it into an emitted producer's `imports:` array when the producer
declares a record-path slot. Hand-authors filling a record-path slot on a
consumer import and apply it directly:

```ts
import { Component } from '@angular/core';
import { RozieSlot } from '@rozie/runtime-angular';
import { DataTable } from './DataTable';

@Component({
  standalone: true,
  imports: [DataTable, RozieSlot],
  template: `
    <rozie-data-table [columns]="columns">
      <ng-template [rozieSlot]="'cell-' + col.key" let-row="row">
        {{ row[col.key] }}
      </ng-template>
    </rozie-data-table>
  `,
})
export class AppComponent {}
```

### The `$implicit` foot-gun

A hand-written `<ng-template let-x>` binds Angular's `$implicit` context key
— and a Rozie producer sets `$implicit` to the **whole context object**, not
a single named value. So `let-row` (the shorthand form) gives you the whole
context object, not just `row`. If you want a single named value out of the
context, you must write the explicit form: `let-row="row"`.

```html
<!-- WRONG: `row` here is the whole context object, not row.id -->
<ng-template [rozieSlot]="'cell-' + col.key" let-row>{{ row.id }}</ng-template>

<!-- RIGHT: destructures the `row` key off the context object -->
<ng-template [rozieSlot]="'cell-' + col.key" let-row="row">{{ row.id }}</ng-template>
```

This is probe-verified — the exploration probe returned
`IMPLICIT_KEYS=[label]` for a multi-key context.

## Attribute spread factories

`createRozieAttrApplier` and `createRozieHostAttrsReader` back the `r-bind`
spread and synthesised `$attrs` auto-fallthrough lowering. A component using
either emits ONE `inject()` call per factory in its own field initializer and
passes the resolved instance into the factory — the factory itself never
calls `inject()` or names an `@angular/core` value or type:

```ts
private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));
private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));
```

This caller-injects contract is deliberate, not incidental: having the
factory resolve `Renderer2`/`ElementRef` itself would make this package
resolve an `@angular/core` DI token from whichever peer-keyed instance pnpm
gave *it*, which is not necessarily the same instance the consuming app's
own `@angular/core` resolves elsewhere in its tree (the same-VERSION-
different-INSTANCE hazard behind `71dff1d5`). Because both factories accept
only structural interfaces (`RozieAttrRenderer`, `RozieHostRef` — defined
locally in this package, not imported from `@angular/core`), no nominal
Angular type ever crosses the package boundary, so that hazard cannot arise
here regardless of instance identity.

Merge semantics are preserved exactly as they were when this logic was
inlined per component: `class` and `style` are MERGE keys, not REPLACE keys
— `createRozieAttrApplier`'s applier merges class tokens via `classList.add`
and applies styles via `style.setProperty(prop, val, 'important')` so the
merge wins over Angular's `[ngClass]`/`ɵɵstyleMap` re-apply, and tracks
per-element previously-applied tokens/properties so a consumer-side drop
removes only this applier's own additions, never the wrapper author's own
static `class`/`style`.

You do not import either factory by hand — `@rozie/target-angular` emits the
`inject()` + factory-call pair automatically whenever a component uses
`r-bind` spread or reads `$attrs`.

## Public exports

- `RozieSlot` — standalone directive, selector `ng-template[rozieSlot]`, with
  `rozieSlot: InputSignal<string>` (the fill key) and
  `templateRef: TemplateRef<unknown>` (the captured template).
- `rozieDisplay(v: unknown): string` — interpolation display helper.
- `rozieAttr(v: unknown): string | null` — whole-value attribute display helper.
- `rozieToken(key: string): InjectionToken<unknown>` — context token registry.
- `createRozieAttrApplier(renderer: RozieAttrRenderer): (el, obj) => void`
- `createRozieHostAttrsReader(host: RozieHostRef): () => Record<string, unknown>`
- `RozieAttrRenderer` / `RozieHostRef` — the structural interface types the
  two factories above accept.

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Angular guide: [`docs/guide/for-angular-shops.md`](../../../docs/guide/for-angular-shops.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
