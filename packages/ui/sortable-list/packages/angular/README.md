# @rozie-ui/sortable-list-angular

Idiomatic **angular** `SortableList` — a cross-framework drag-and-drop list compiled from one [Rozie](https://github.com/) source via SortableJS. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/sortable-list-angular
```

Peer dependencies: `sortablejs ^1.15` + `@angular/core + @angular/common`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { SortableList } from '@rozie-ui/sortable-list-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [SortableList],
  template: `
    <SortableList [items]="items" (itemsChange)="items = $event" itemKey="id">
      <ng-template #default let-item="item">
        <span>{{ item.label }}</span>
      </ng-template>
    </SortableList>
  `,
})
export class DemoComponent {
  items = [
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ];
}
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `items` model prop is the control value — so it binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { SortableList } from '@rozie-ui/sortable-list-angular';

@Component({
  selector: 'app-ranking-form',
  standalone: true,
  imports: [SortableList, ReactiveFormsModule],
  template: `
    <!-- The user's drag-ordering IS the form value -->
    <SortableList [formControl]="ranking" itemKey="id">
      <ng-template #default let-item="item">
        <span>{{ item.label }}</span>
      </ng-template>
    </SortableList>
  `,
})
export class RankingFormComponent {
  ranking = new FormControl([
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ]);
}

// Template-driven forms work the same way:
//   <SortableList [(ngModel)]="ranking" name="ranking" itemKey="id">...</SortableList>
```

The accessor contract: only real user interaction dirties the control — programmatic writes (form `setValue` / `reset`, or the `[(items)]` two-way binding) update the view without echoing back into the form; `writeValue(null)` resets to the prop default (`[]`); the control is marked touched on focusout; and `setDisabledState` OR-merges with the `disabled` prop, so either source disables the component.

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `items` | `Array` | `[]` | ✓ |  |
| `itemKey` | `String` | `null` |  |  |
| `handle` | `String` | `null` |  |  |
| `group` | `String` | `null` |  |  |
| `animation` | `Number` | `150` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `options` | `Object` | `{}` |  |  |
| `labelFor` | `Function` | `null` |  |  |
| `ghostClass` | `String` | `null` |  |  |
| `chosenClass` | `String` | `null` |  |  |
| `dragClass` | `String` | `null` |  |  |
| `filter` | `String` | `null` |  |  |
| `easing` | `String` | `null` |  |  |
| `forceFallback` | `Boolean` | `false` |  |  |
| `swapThreshold` | `Number` | `1` |  |  |
| `cloneable` | `Boolean` | `false` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired after the list order changes (same-list reorder commit). |
| `add` | Fired when an item is added from another list (cross-list destination commit). |
| `remove` | Fired when an item is moved out to another list (cross-list source commit; not fired in clone mode). |
| `start` | Fired when dragging starts. |
| `end` | Fired when dragging ends (source side). |

## Slots

| Slot | Params |
| --- | --- |
| (default) | item, index |
