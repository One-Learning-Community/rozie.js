# @rozie-ui/resizable-angular

Idiomatic **angular** `Resizable` — a headless, accessible two-panel splitter / resizable pane (pointer-drag + pointer capture, `role="separator"` keyboard control with Arrow / Home / End, a `[min, max]` clamp, a two-way `size` percent, and `start` / `end` / `handle` slots) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native Pointer Events plus the keyboard; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/resizable-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { Resizable } from '@rozie-ui/resizable-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Resizable],
  template: `
    <div style="height: 320px">
      <Resizable [(size)]="split" [min]="20" [max]="80" direction="horizontal" (resize)="onResize($event)">
        <ng-template #start><nav>Sidebar</nav></ng-template>
        <ng-template #end><main>Content</main></ng-template>
      </Resizable>
    </div>
  `,
})
export class DemoComponent {
  split = 30;
  onResize(e: { size: number }) {
    console.log('split:', e.size);
  }
}
```

## Theming

Every visual value is a `--rozie-resizable-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/resizable-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `size` model prop is the control value, so the splitter position **is** a form control. It binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Resizable } from '@rozie-ui/resizable-angular';

@Component({
  selector: 'app-resizable-form',
  standalone: true,
  imports: [Resizable, ReactiveFormsModule],
  template: `
    <!-- The first-panel percent IS the form control value -->
    <Resizable [formControl]="split" [min]="20" [max]="80">
      <ng-template #start><nav>Sidebar</nav></ng-template>
      <ng-template #end><main>Content</main></ng-template>
    </Resizable>
  `,
})
export class ResizableFormComponent {
  split = new FormControl<number>(30);
}

// Template-driven forms work the same way:
//   <Resizable [(ngModel)]="split" name="split" />
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `size` | `Number` | `50` | ✓ |  | The first (`start`) panel's size as a percent of the container along the split axis (its width when `direction="horizontal"`, its height when `"vertical"`). Two-way via `r-model:size`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so the splitter position **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Every commit (drag, keyboard, or a programmatic `applySize`) is clamped to `[min, max]` and written back. |
| `direction` | `String` | `"horizontal"` |  |  | The split axis. `'horizontal'` (default) lays the two panels out side-by-side with a vertical drag handle between them (`size` is the first panel's **width**); `'vertical'` stacks them with a horizontal handle (`size` is the first panel's **height**). Also sets the handle's `aria-orientation`. |
| `min` | `Number` | `10` |  |  | The minimum `size` percent — the first panel can never be dragged or nudged below this. Clamps every commit. |
| `max` | `Number` | `90` |  |  | The maximum `size` percent — the first panel can never be dragged or nudged beyond this (so the second panel keeps at least `100 - max` percent). Clamps every commit. |
| `disabled` | `Boolean` | `false` |  |  | Disable resizing — the handle becomes non-interactive (pointer drag and keyboard are ignored) and the panels lock at the current `size`. Also sets the Angular `ControlValueAccessor` disabled state. |

## Events

| Event | Description |
| --- | --- |
| `resize` | Fired on every committed size change (pointer drag, Arrow/Home/End keyboard nudge, or a programmatic `applySize` / `reset`). Payload `{ size }` — the new first-panel percent, already clamped to `[min, max]`. Funneled through one `commitSize` wrapper so the React prop-destructure hoists exactly once. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `applySize` | Set the split position programmatically to `percent` (the first-panel size); clamped to `[min, max]` and emits `resize`. Named `applySize` rather than `setSize` to avoid the React state-setter generated for the `size` model prop (ROZ524). |
| `reset` | Recentre the split to the midpoint of `[min, max]` (emits `resize`). |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Resizable) split!: Resizable;   // or the viewChild() signal
  setHalf() { this.split.applySize(50); }
  reset() { this.split.reset(); }
}
```

## Slots

| Slot | Params |
| --- | --- |
| start |  |
| handle |  |
| end |  |

Project the two panes into the `start` and `end` slots; the optional `handle` slot replaces the default grip while keeping the drag/keyboard behavior. On React/Solid the slots are `render*` props (`renderStart` / `renderEnd` / `renderHandle`) — the documented cross-framework slot divergence.
