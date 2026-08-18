# @rozie/runtime-angular

The `RozieSlot` marker directive — the only export this package ships. It is
what a Rozie-emitted Angular producer collects, via `contentChildren`, to
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

## Public exports

- `RozieSlot` — standalone directive, selector `ng-template[rozieSlot]`, with
  `rozieSlot: InputSignal<string>` (the fill key) and
  `templateRef: TemplateRef<unknown>` (the captured template).

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Angular guide: [`docs/guide/for-angular-shops.md`](../../../docs/guide/for-angular-shops.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
