# @rozie-ui/pagination-angular

Idiomatic **angular** `Pagination` — a headless, fully-accessible (WAI-ARIA) pagination control (a windowed page-item model with ellipses, sibling/boundary windowing, prev/next bounds, roving keyboard navigation, and a `<nav>` landmark) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. It is HEADLESS: expose the page-item model and render each control yourself via the scoped slots, or accept the default token-themed buttons. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/pagination-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { Pagination } from '@rozie-ui/pagination-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Pagination],
  template: `
    <Pagination [(modelValue)]="page" [total]="195" [pageSize]="10" (change)="onChange($event)" />
  `,
})
export class DemoComponent {
  page = 1;
  onChange(e: { page: number }) {
    console.log('page:', e.page);
  }
}
```

## Theming

Every visual value is a `--rozie-pagination-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/pagination-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `modelValue` model prop is the control value, so the pager binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Pagination } from '@rozie-ui/pagination-angular';

@Component({
  selector: 'app-pagination-form',
  standalone: true,
  imports: [Pagination, ReactiveFormsModule],
  template: `
    <!-- The current page IS the form control value -->
    <Pagination [formControl]="page" [total]="195" [pageSize]="10" />
  `,
})
export class PaginationFormComponent {
  page = new FormControl<number>(1);
}

// Template-driven forms work the same way:
//   <Pagination [(ngModel)]="page" name="page" [total]="195" [pageSize]="10" />
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `modelValue` | `Number` | `1` | ✓ |  | The 1-based current page (two-way model). Clamped into `[1, totalPages]`. Bind it with `r-model:modelValue` / `v-model:modelValue` / `modelValue` + `onModelValueChange`; it is also the Angular ControlValueAccessor control value. |
| `totalPages` | `Number` | `null` |  |  | Explicit total page count. When provided (> 0) it takes precedence over `total` + `pageSize`. Use it when the backend already reports the page count. |
| `total` | `Number` | `null` |  |  | Total item count. Combined with `pageSize` to derive the page count (`ceil(total / pageSize)`) when `totalPages` is not given. |
| `pageSize` | `Number` | `null` |  |  | Items per page. Combined with `total` to derive the page count when `totalPages` is not given. |
| `siblingCount` | `Number` | `1` |  |  | Number of page buttons shown on each side of the current page (the sibling window). Larger values show more context around the current page. |
| `boundaryCount` | `Number` | `1` |  |  | Number of page buttons always shown at each boundary (the first and last `boundaryCount` pages), regardless of the current page. |
| `disabled` | `Boolean` | `false` |  |  | Disable the entire control — every page button and the prev/next controls become non-interactive and are marked `aria-disabled`. |
| `ariaLabel` | `String` | `"Pagination"` |  |  | Accessible name for the surrounding `<nav>` landmark (its `aria-label`). Defaults to `"Pagination"`. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the current page changes (a page button, prev/next, or a programmatic `goto`/`next`/`prev`/`first`/`last`). Payload `{ page }` — the new clamped 1-based page. Not fired when the target page equals the current page. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `goto` | Go to a specific 1-based page; the argument is clamped into `[1, totalPages]`. Emits `change` unless the target equals the current page. |
| `next` | Advance to the next page (no-op at the last page). Emits `change` on success. |
| `prev` | Go back to the previous page (no-op at the first page). Emits `change` on success. |
| `first` | Jump to the first page (page 1). Emits `change` unless already there. |
| `last` | Jump to the last page (the effective `totalPages`). Emits `change` unless already there. |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Pagination) pager!: Pagination;   // or the viewChild() signal
  goNext() { this.pager.next(); }
  jump() { this.pager.goto(5); }
}
```

## Slots

| Slot | Params |
| --- | --- |
| prevControl | disabled, goto, page |
| ellipsis | index |
| item | page, selected, goto |
| nextControl | disabled, goto, page |
