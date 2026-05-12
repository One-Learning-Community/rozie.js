<script setup>
import { ref } from 'vue';
import Dropdown from '../../examples/Dropdown.rozie';

const dropdownOpen = ref(false);
</script>

# Dropdown

The marquee `<listeners>` example. Shows the `.outside(...$refs)` modifier eliminating hand-rolled outside-click detection, `.throttle(100).passive` on a window resize, reactive `when` predicates that auto-attach/detach listeners, multiple `$onMount` hooks colocated with their setup, named slots with scoped params (`#trigger="{ open, toggle }"`), and `$props` writes flowing through to each target's two-way pattern because `open` is declared `model: true`.

## Live demo

Click the trigger to open. Then try: clicking outside the panel (closes via `.outside($refs.triggerEl, $refs.panelEl)`), pressing Escape (closes via `document:keydown.escape`), or resizing the window with the panel open (the panel's position updates, throttled to 100ms via `.throttle(100).passive`).

<div class="rozie-demo">
  <ClientOnly>
    <Dropdown v-model:open="dropdownOpen">
      <!--
        Note: do NOT bind @click="toggle" on the trigger button. Dropdown.rozie's
        wrapper div already calls toggle on click and the event bubbles up — adding
        an inner @click handler would double-fire and immediately re-close. The
        slot's `:toggle` param is exposed for programmatic use (e.g. closing from
        a different in-panel action), not for wiring the trigger click itself.
      -->
      <template #trigger="{ open }">
        <button>{{ open ? 'Close' : 'Open' }} dropdown</button>
      </template>
      <ul style="margin: 0; padding: 0.25rem; list-style: none; min-width: 12rem;">
        <li style="padding: 0.25rem 0.75rem; cursor: pointer;">First menu item</li>
        <li style="padding: 0.25rem 0.75rem; cursor: pointer;">Second menu item</li>
        <li style="padding: 0.25rem 0.75rem; cursor: pointer;">Third menu item</li>
      </ul>
    </Dropdown>
  </ClientOnly>
</div>

## Source — Dropdown.rozie

```rozie
<rozie name="Dropdown">

<props>
{
  open:                { type: Boolean, default: false, model: true },
  closeOnOutsideClick: { type: Boolean, default: true },
  closeOnEscape:       { type: Boolean, default: true },
}
</props>

<script>
const toggle = () => { $props.open = !$props.open }
const close  = () => { $props.open = false }

const reposition = () => {
  if (!$refs.panelEl || !$refs.triggerEl) return
  const rect = $refs.triggerEl.getBoundingClientRect()
  Object.assign($refs.panelEl.style, {
    top:  `${rect.bottom}px`,
    left: `${rect.left}px`,
  })
}

// Multiple $onMount calls run in source order. Useful for colocating setup
// with the logic it serves.
$onMount(() => {
  reposition()
})

$onMount(() => {
  // Example of integrating a vanilla JS library — $refs gives direct DOM access.
  // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
})
</script>

<listeners>
{
  // .outside takes ref args; fires only when the click target is outside ALL listed refs.
  // Compiler emits the per-target wiring (Vue watchEffect, React useEffect with auto-deps,
  // Svelte $effect, Angular effect + Renderer2.listen + DestroyRef cleanup).
  "document:click.outside($refs.triggerEl, $refs.panelEl)": {
    when:    "$props.open && $props.closeOnOutsideClick",
    handler: close,
  },
  "document:keydown.escape": {
    when:    "$props.open && $props.closeOnEscape",
    handler: close,
  },
  "window:resize.throttle(100).passive": {
    when:    "$props.open",
    handler: reposition,
  },
}
</listeners>

<template>
<div class="dropdown">
  <div ref="triggerEl" @click="toggle">
    <slot name="trigger" :open="$props.open" :toggle="toggle" />
  </div>

  <div r-if="$props.open" ref="panelEl" class="dropdown-panel" role="menu">
    <slot :close="close" />
  </div>
</div>
</template>

<style>
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  position: fixed;
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Unscoped escape hatch — anything inside :root { } is emitted globally. */
:root {
  --rozie-dropdown-z: 1000;
}
</style>

</rozie>
```

## Vue output

```vue
<template>

<div class="dropdown">
  <div ref="triggerElRef" @click="toggle">
    <slot name="trigger" :open="open" :toggle="toggle"></slot>
  </div>

  <div v-if="open" ref="panelElRef" class="dropdown-panel" role="menu">
    <slot :close="close"></slot>
  </div></div>

</template>

<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue';
import { throttle, useOutsideClick } from '@rozie/runtime-vue';

const props = withDefaults(
  defineProps<{ closeOnOutsideClick?: boolean; closeOnEscape?: boolean }>(),
  { closeOnOutsideClick: true, closeOnEscape: true }
);

const open = defineModel<boolean>('open', { default: false });

defineSlots<{
  trigger(props: { open: any; toggle: any }): any;
  default(props: { close: any }): any;
}>();

const triggerElRef = ref<HTMLElement>();
const panelElRef = ref<HTMLElement>();

const toggle = () => {
  open.value = !open.value;
};
const close = () => {
  open.value = false;
};
const reposition = () => {
  if (!panelElRef.value || !triggerElRef.value) return;
  const rect = triggerElRef.value.getBoundingClientRect();
  Object.assign(panelElRef.value.style, {
    top: `${rect.bottom}px`,
    left: `${rect.left}px`
  });
};

// Multiple $onMount calls run in source order. Useful for colocating setup
// with the logic it serves.

onMounted(() => {
  reposition();
});
onMounted(() => {
  // Example of integrating a vanilla JS library — $refs gives direct DOM access.
  // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
});

useOutsideClick(
  [triggerElRef, panelElRef],
  () => close(),
  () => open.value && props.closeOnOutsideClick,
);

watchEffect((onCleanup) => {
  if (!(open.value && props.closeOnEscape)) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    close();
  };
  document.addEventListener('keydown', handler);
  onCleanup(() => document.removeEventListener('keydown', handler));
});

const throttledLReposition = throttle(reposition, 100);
watchEffect((onCleanup) => {
  if (!(open.value)) return;
  window.addEventListener('resize', throttledLReposition, { passive: true });
  onCleanup(() => window.removeEventListener('resize', throttledLReposition, { passive: true }));
});
</script>

<style scoped>
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  position: fixed;
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
</style>

<style>
:root {
  --rozie-dropdown-z: 1000;
}
</style>
```

## React output

```tsx
import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useControllableState, useOutsideClick, useThrottledCallback } from '@rozie/runtime-react';
import styles from './Dropdown.module.css';
import './Dropdown.global.css';

interface TriggerCtx { open: any; toggle: any; }

interface ChildrenCtx { close: any; }

interface DropdownProps {
  open?: boolean;
  defaultValue?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  renderTrigger?: (ctx: TriggerCtx) => ReactNode;
  children?: (ctx: ChildrenCtx) => ReactNode;
}

export default function Dropdown(_props: DropdownProps): JSX.Element {
  const props: DropdownProps = {
    ..._props,
    closeOnOutsideClick: _props.closeOnOutsideClick ?? true,
    closeOnEscape: _props.closeOnEscape ?? true,
  };
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultValue ?? false,
    onValueChange: props.onOpenChange,
  });
  const triggerEl = useRef<HTMLDivElement | null>(null);
  const panelEl = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);
  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);
  const reposition = useCallback(() => {
    if (!panelEl.current || !triggerEl.current) return;
    const rect = triggerEl.current.getBoundingClientRect();
    Object.assign(panelEl.current.style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  }, []);

  useEffect(() => {
    reposition();
  }, [reposition]);
  useEffect(() => {
    
  }, []);

  const _rozieThrottledLReposition = useThrottledCallback(reposition, [open, reposition], 100);

  useOutsideClick(
    [triggerEl, panelEl],
    close,
    () => open && props.closeOnOutsideClick,
  );

  useEffect(() => {
    if (!(open && props.closeOnEscape)) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close(e);
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [close, open, props.closeOnEscape]);

  useEffect(() => {
    if (!(open)) return;
    window.addEventListener('resize', _rozieThrottledLReposition, { passive: true });
    return () => window.removeEventListener('resize', _rozieThrottledLReposition, { passive: true });
  }, [_rozieThrottledLReposition, open, reposition]);

  return (
    <>
    <div className={styles.dropdown}>
      <div ref={triggerEl} onClick={toggle}>
        {props.renderTrigger?.({ open, toggle })}
      </div>

      {(open) && <div ref={panelEl} className={styles["dropdown-panel"]} role="menu">
        {props.children?.({ close })}
      </div>}</div>
    </>
  );
}
```

## Svelte output

```svelte
<script lang="ts">
const throttledLReposition = (() => {
  let lastCall = 0;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - lastCall < 100) return;
    lastCall = now;
    (reposition)(...args);
  };
})();

import type { Snippet } from 'svelte';

interface Props {
  open?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  trigger?: Snippet<[any, any]>;
  children?: Snippet<[any]>;
}

let {
  open = $bindable(false),
  closeOnOutsideClick = true,
  closeOnEscape = true,
  trigger,
  children,
}: Props = $props();

let triggerEl = $state<HTMLElement | undefined>(undefined);
let panelEl = $state<HTMLElement | undefined>(undefined);

const toggle = () => {
  open = !open;
};
const close = () => {
  open = false;
};
const reposition = () => {
  if (!panelEl || !triggerEl) return;
  const rect = triggerEl.getBoundingClientRect();
  Object.assign(panelEl.style, {
    top: `${rect.bottom}px`,
    left: `${rect.left}px`
  });
};

// Multiple $onMount calls run in source order. Useful for colocating setup
// with the logic it serves.

$effect(() => {
  reposition();
});
$effect(() => {
  // Example of integrating a vanilla JS library — $refs gives direct DOM access.
  // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
});

$effect(() => {
  if (!(open && closeOnOutsideClick)) return;
  const handler = (e: MouseEvent) => {
    const target = e.target as Node;
    if (triggerEl?.contains(target) || panelEl?.contains(target)) return;
    close();
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
});

$effect(() => {
  if (!(open && closeOnEscape)) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    close();
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
});

$effect(() => {
  if (!(open)) return;
  window.addEventListener('resize', throttledLReposition, { passive: true });
  return () => window.removeEventListener('resize', throttledLReposition, { passive: true });
});
</script>


<div class="dropdown">
  <div bind:this={triggerEl} onclick={toggle}>
    {@render trigger?.(open, toggle)}
  </div>

  {#if open}<div bind:this={panelEl} class="dropdown-panel" role="menu">
    {@render children?.(close)}
  </div>{/if}</div>


<style>
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  position: fixed;
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:global(:root) {
--rozie-dropdown-z: 1000;
}
</style>
```

## Angular output

```ts
import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, inject, input, model, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface TriggerCtx {
  $implicit: { open: any; toggle: any };
  open: any;
  toggle: any;
}

interface DefaultCtx {
  $implicit: { close: any };
  close: any;
}

@Component({
  selector: 'rozie-dropdown',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="dropdown">
      <div #triggerEl (click)="toggle($event)">
        <ng-container *ngTemplateOutlet="triggerTpl; context: { $implicit: { open: open(), toggle: toggle }, open: open(), toggle: toggle }" />
      </div>

      @if (open()) {
    <div #panelEl class="dropdown-panel" role="menu">
        <ng-container *ngTemplateOutlet="defaultTpl; context: { $implicit: { close: close }, close: close }" />
      </div>
    }</div>

  `,
  styles: [`
    .dropdown { position: relative; display: inline-block; }
    .dropdown-panel {
      position: fixed;
      z-index: var(--rozie-dropdown-z, 1000);
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    ::ng-deep :root {
    --rozie-dropdown-z: 1000;
    }
  `],
})
export class Dropdown {
  open = model<boolean>(false);
  closeOnOutsideClick = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  triggerEl = viewChild<ElementRef<HTMLDivElement>>('triggerEl');
  panelEl = viewChild<ElementRef<HTMLDivElement>>('panelEl');
  @ContentChild('trigger', { read: TemplateRef }) triggerTpl?: TemplateRef<TriggerCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open() && this.closeOnOutsideClick())) return;
        const handler = (e: MouseEvent) => {
          const target = e.target as Node;
          if (this.triggerEl()?.nativeElement?.contains(target) || this.panelEl()?.nativeElement?.contains(target)) return;
          this.close();
        };
        const unlisten = renderer.listen('document', 'click', handler);
        onCleanup(unlisten);
      });

      effect((onCleanup) => {
        if (!(this.open() && this.closeOnEscape())) return;
        const handler = (e: KeyboardEvent) => {
          if (e.key !== 'Escape') return;
          this.close();
        };
        const unlisten = renderer.listen('document', 'keydown', handler);
        onCleanup(unlisten);
      });

      effect((onCleanup) => {
        if (!(this.open())) return;
        const unlisten = renderer.listen('window', 'resize', this.throttledLReposition);
        onCleanup(unlisten);
      });

    this.reposition();

  }

  toggle = () => {
    this.open.set(!this.open());
  };
  close = () => {
    this.open.set(false);
  };
  reposition = () => {
    if (!this.panelEl()?.nativeElement || !this.triggerEl()?.nativeElement) return;
    const rect = (this.triggerEl()?.nativeElement).getBoundingClientRect();
    Object.assign((this.panelEl()?.nativeElement).style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  };

  static ngTemplateContextGuard(
    _dir: Dropdown,
    _ctx: unknown,
  ): _ctx is TriggerCtx | DefaultCtx {
    return true;
  }

  private throttledLReposition = (() => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall < 100) return;
      lastCall = now;
      (this.reposition)(...args);
    };
  })();
}

export default Dropdown;
```

## Solid output

```tsx
import type { JSX } from 'solid-js';
import { Show, children, createEffect, onCleanup, onMount, splitProps } from 'solid-js';
import { createControllableSignal, createOutsideClick, createThrottledHandler } from '@rozie/runtime-solid';

interface TriggerSlotCtx { open: any; toggle: any; }

interface DropdownProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  triggerSlot?: (ctx: TriggerSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
}

export default function Dropdown(_props: DropdownProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['open', 'closeOnOutsideClick', 'closeOnEscape', 'children']);
  const resolved = children(() => local.children);

  const [open, setOpen] = createControllableSignal(_props as Record<string, unknown>, 'open', false);
  onMount(() => {
    reposition();
  });
  onMount(() => {});
  let triggerElRef: HTMLElement | null = null;
  let panelElRef: HTMLElement | null = null;

  const toggle = () => {
    setOpen(!open());
  };
  const close = () => {
    setOpen(false);
  };
  const reposition = () => {
    if (!panelElRef || !triggerElRef) return;
    const rect = triggerElRef.getBoundingClientRect();
    Object.assign(panelElRef.style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  };

  // Multiple $onMount calls run in source order. Useful for colocating setup
  // with the logic it serves.

  const _rozieThrottleLReposition = createThrottledHandler(reposition, 100);

  createOutsideClick(
    [() => triggerElRef, () => panelElRef],
    close,
    () => open() && local.closeOnOutsideClick,
  );

  createEffect(() => {
    if (!(open() && local.closeOnEscape)) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
    };
    document.addEventListener('keydown', _rozieHandler);
    onCleanup(() => document.removeEventListener('keydown', _rozieHandler));
  });

  createEffect(() => {
    if (!(open())) return;
    window.addEventListener('resize', _rozieThrottleLReposition, { passive: true } as AddEventListenerOptions);
    onCleanup(() => window.removeEventListener('resize', _rozieThrottleLReposition, { passive: true } as AddEventListenerOptions));
  });

  return (
    <>
    <style>{`.dropdown { position: relative; display: inline-block; }
    .dropdown-panel {
      position: fixed;
      z-index: var(--rozie-dropdown-z, 1000);
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }`}</style>
    <style>{`:root {
      --rozie-dropdown-z: 1000;
    }`}</style>
    <>
    <div class={"dropdown"}>
      <div ref={(el) => { triggerElRef = el as HTMLElement; }} onClick={toggle}>
        {_props.triggerSlot?.({ open: open(), toggle })}
      </div>

      {<Show when={open()}><div ref={(el) => { panelElRef = el as HTMLElement; }} class={"dropdown-panel"} role="menu">
        {resolved()}
      </div></Show>}</div>
    </>
    </>
  );
}
```
