<script setup>
import { ref } from 'vue';
import Modal from '../../examples/Modal.rozie';

const showModal = ref(false);
const closeCount = ref(0);
</script>

# Modal

The heaviest example in this set. Demonstrates the `<listeners>` block, `.self` modifier on a backdrop click, multiple colocated `$onMount` / `$onUnmount` hooks, `$emit` for parent-controlled close, named slots with scoped params, `r-if` (full unmount, not just hidden), and the `<components>` block (Modal embeds Counter in its body).

## Live demo

Click the button to open the *actual* `examples/Modal.rozie`. Press Escape, click the backdrop, or hit the × button to close. The Modal's body has a `<Counter />` inside it — that nested component is `examples/Counter.rozie`, resolved by the unplugin via Modal's `<components>` block.

<button @click="showModal = true">Open Modal</button>

(closed {{ closeCount }} time{{ closeCount === 1 ? '' : 's' }})

<ClientOnly>
  <Modal v-model:open="showModal" :lock-body-scroll="false" title="Hello from Rozie" @close="closeCount++">
    <p>This is the default slot. The header above is the named <code>header</code> slot's fallback content (since we didn't provide one); the title shown there is the <code>title</code> prop.</p>
    <p>The Counter below is <code>examples/Counter.rozie</code>, rendered through Modal's <code>&lt;components&gt;</code> block.</p>
  </Modal>
</ClientOnly>

## Source — Modal.rozie

```rozie
<rozie name="Modal">

<props>
{
  open:           { type: Boolean, default: false, model: true },
  closeOnEscape:  { type: Boolean, default: true },
  closeOnBackdrop:{ type: Boolean, default: true },
  lockBodyScroll: { type: Boolean, default: true },
  title:          { type: String,  default: '' },
}
</props>

<components>
{
  Counter: './Counter.rozie',
}
</components>

<script>
const close = () => { $props.open = false; $emit('close') }

// Body-scroll-lock state lives outside reactive data because it tracks DOM
// rather than UI; managed entirely via lifecycle and listeners.
let savedBodyOverflow = ''

const lockScroll = () => {
  if (!$props.lockBodyScroll) return
  savedBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

const unlockScroll = () => {
  if (!$props.lockBodyScroll) return
  document.body.style.overflow = savedBodyOverflow
}

// Colocated lifecycle pair — runs in source order alongside other hooks.
$onMount(lockScroll)
$onUnmount(unlockScroll)

// Colocated focus management — separate hook, separate concern.
$onMount(() => {
  $refs.dialogEl?.focus()
})
</script>

<listeners>
{
  "document:keydown.escape": {
    when:    "$props.open && $props.closeOnEscape",
    handler: close,
  },
}
</listeners>

<template>
<div r-if="$props.open" class="modal-backdrop" ref="backdropEl" @click.self="$props.closeOnBackdrop && close()">
  <div
    ref="dialogEl"
    class="modal-dialog"
    role="dialog"
    aria-modal="true"
    :aria-label="$props.title || undefined"
    tabindex="-1"
  >
    <header r-if="$props.title || $slots.header">
      <slot name="header" :close="close">
        <h2>{{ $props.title }}</h2>
      </slot>
      <button class="close-btn" @click="close" aria-label="Close">×</button>
    </header>

    <div class="modal-body">
      <slot :close="close" />
      <Counter />
    </div>

    <footer r-if="$slots.footer">
      <slot name="footer" :close="close" />
    </footer>
  </div>
</div>
</template>

<style>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--rozie-modal-z, 2000);
}
.modal-dialog {
  background: white;
  border-radius: 8px;
  min-width: 20rem;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  outline: none;
}
header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
.modal-body { padding: 1rem; overflow: auto; }
.close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }

:root {
  --rozie-modal-z: 2000;
}
</style>

</rozie>
```

## Vue output

```vue
<template>

<div v-if="open" class="modal-backdrop" ref="backdropElRef" @click.self="props.closeOnBackdrop && close()">
  <div ref="dialogElRef" class="modal-dialog" role="dialog" aria-modal="true" :aria-label="props.title || undefined" tabindex="-1">
    <header v-if="props.title || $slots.header">
      <slot name="header" :close="close">
        <h2>{{ props.title }}</h2>
      </slot>
      <button class="close-btn" aria-label="Close" @click="close">×</button>
    </header><div class="modal-body">
      <slot :close="close"></slot>
      <Counter></Counter>
    </div>

    <footer v-if="$slots.footer">
      <slot name="footer" :close="close"></slot>
    </footer></div>
</div>
</template>

<script setup lang="ts">
import Counter from './Counter.vue';

import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';

const props = withDefaults(
  defineProps<{ closeOnEscape?: boolean; closeOnBackdrop?: boolean; lockBodyScroll?: boolean; title?: string }>(),
  { closeOnEscape: true, closeOnBackdrop: true, lockBodyScroll: true, title: '' }
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  close: [...args: any[]];
}>();

defineSlots<{
  header(props: { close: any }): any;
  default(props: { close: any }): any;
  footer(props: { close: any }): any;
}>();

const backdropElRef = ref<HTMLElement>();
const dialogElRef = ref<HTMLElement>();

const close = () => {
  open.value = false;
  emit('close');
};

// Body-scroll-lock state lives outside reactive data because it tracks DOM
// rather than UI; managed entirely via lifecycle and listeners.
// Body-scroll-lock state lives outside reactive data because it tracks DOM
// rather than UI; managed entirely via lifecycle and listeners.
let savedBodyOverflow = '';
const lockScroll = () => {
  if (!props.lockBodyScroll) return;
  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
};
const unlockScroll = () => {
  if (!props.lockBodyScroll) return;
  document.body.style.overflow = savedBodyOverflow;
};

// Colocated lifecycle pair — runs in source order alongside other hooks.

onMounted(lockScroll);
onBeforeUnmount(unlockScroll);
onMounted(() => {
  dialogElRef.value?.focus();
});

watchEffect((onCleanup) => {
  if (!(open.value && props.closeOnEscape)) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    close();
  };
  document.addEventListener('keydown', handler);
  onCleanup(() => document.removeEventListener('keydown', handler));
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--rozie-modal-z, 2000);
}
.modal-dialog {
  background: white;
  border-radius: 8px;
  min-width: 20rem;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  outline: none;
}
header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
.modal-body { padding: 1rem; overflow: auto; }
.close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }
</style>

<style>
:root {
  --rozie-modal-z: 2000;
}
</style>
```

## React output

```tsx
import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useControllableState } from '@rozie/runtime-react';
import styles from './Modal.module.css';
import './Modal.global.css';
import Counter from './Counter';

interface HeaderCtx { close: any; }

interface ChildrenCtx { close: any; }

interface FooterCtx { close: any; }

interface ModalProps {
  open?: boolean;
  defaultValue?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  onClose?: (...args: unknown[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  children?: (ctx: ChildrenCtx) => ReactNode;
  renderFooter?: (ctx: FooterCtx) => ReactNode;
}

export default function Modal(_props: ModalProps): JSX.Element {
  const props: ModalProps = {
    ..._props,
    closeOnEscape: _props.closeOnEscape ?? true,
    closeOnBackdrop: _props.closeOnBackdrop ?? true,
    lockBodyScroll: _props.lockBodyScroll ?? true,
    title: _props.title ?? '',
  };
  const savedBodyOverflow = useRef('');
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultValue ?? false,
    onValueChange: props.onOpenChange,
  });
  const backdropEl = useRef<HTMLDivElement | null>(null);
  const dialogEl = useRef<HTMLDivElement | null>(null);

  const { onClose: _rozieProp_onClose } = props;
    const close = useCallback(() => {
    setOpen(false);
    _rozieProp_onClose && _rozieProp_onClose();
  }, [_rozieProp_onClose, setOpen]);
  const lockScroll = useCallback(() => {
    if (!props.lockBodyScroll) return;
    savedBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }, [props.lockBodyScroll]);
  const unlockScroll = useCallback(() => {
    if (!props.lockBodyScroll) return;
    document.body.style.overflow = savedBodyOverflow.current;
  }, [props.lockBodyScroll]);

  useEffect(() => {
    lockScroll();
    return () => unlockScroll();
  }, [lockScroll, unlockScroll]);
  useEffect(() => {
    dialogEl.current?.focus();
  }, []);

  useEffect(() => {
    if (!(open && props.closeOnEscape)) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close(e);
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [close, open, props.closeOnEscape]);

  return (
    <>
    {(open) && <div className={styles["modal-backdrop"]} ref={backdropEl} onClick={(e) => { if (e.target !== e.currentTarget) return; props.closeOnBackdrop && close(); }}>
      <div ref={dialogEl} className={styles["modal-dialog"]} role="dialog" aria-modal="true" aria-label={props.title || undefined} tabIndex={-1}>
        {(props.title || props.renderHeader) && <header>
          {props.renderHeader ? props.renderHeader({ close }) : <h2>{props.title}</h2>}
          <button className={styles["close-btn"]} aria-label="Close" onClick={close}>×</button>
        </header>}<div className={styles["modal-body"]}>
          {props.children?.({ close })}
          <Counter />
        </div>

        {(props.renderFooter) && <footer>
          {props.renderFooter?.({ close })}
        </footer>}</div>
    </div>}</>
  );
}
```

## Svelte output

```svelte
<script lang="ts">
import Counter from './Counter.svelte';

import type { Snippet } from 'svelte';

interface Props {
  open?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  header?: Snippet<[any]>;
  children?: Snippet<[any]>;
  footer?: Snippet<[any]>;
  onclose?: (...args: unknown[]) => void;
}

let {
  open = $bindable(false),
  closeOnEscape = true,
  closeOnBackdrop = true,
  lockBodyScroll = true,
  title = '',
  header,
  children,
  footer,
  onclose,
}: Props = $props();

let backdropEl = $state<HTMLElement | undefined>(undefined);
let dialogEl = $state<HTMLElement | undefined>(undefined);

const close = () => {
  open = false;
  onclose?.();
};

// Body-scroll-lock state lives outside reactive data because it tracks DOM
// rather than UI; managed entirely via lifecycle and listeners.
// Body-scroll-lock state lives outside reactive data because it tracks DOM
// rather than UI; managed entirely via lifecycle and listeners.
let savedBodyOverflow = '';
const lockScroll = () => {
  if (!lockBodyScroll) return;
  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
};
const unlockScroll = () => {
  if (!lockBodyScroll) return;
  document.body.style.overflow = savedBodyOverflow;
};

// Colocated lifecycle pair — runs in source order alongside other hooks.

$effect(() => {
  lockScroll();
  return () => unlockScroll();
});
$effect(() => {
  dialogEl?.focus();
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
</script>


{#if open}<div class="modal-backdrop" bind:this={backdropEl} onclick={(e) => { if (e.target !== e.currentTarget) return; closeOnBackdrop && close(); }}>
  <div bind:this={dialogEl} class="modal-dialog" role="dialog" aria-modal="true" aria-label={title || undefined} tabindex="-1">
    {#if title || header}<header>
      {#if header}{@render header(close)}{:else}
        <h2>{title}</h2>
      {/if}
      <button class="close-btn" aria-label="Close" onclick={close}>×</button>
    </header>{/if}<div class="modal-body">
      {@render children?.(close)}
      <Counter></Counter>
    </div>

    {#if footer}<footer>
      {#if footer}{@render footer(close)}{/if}
    </footer>{/if}</div>
</div>{/if}

<style>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--rozie-modal-z, 2000);
}
.modal-dialog {
  background: white;
  border-radius: 8px;
  min-width: 20rem;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  outline: none;
}
header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
.modal-body { padding: 1rem; overflow: auto; }
.close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }

:global(:root) {
--rozie-modal-z: 2000;
}
</style>
```

## Angular output

```ts
import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, inject, input, model, output, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Counter } from './Counter';

interface HeaderCtx {
  $implicit: { close: any };
  close: any;
}

interface DefaultCtx {
  $implicit: { close: any };
  close: any;
}

interface FooterCtx {
  $implicit: { close: any };
  close: any;
}

@Component({
  selector: 'rozie-modal',
  standalone: true,
  imports: [NgTemplateOutlet, Counter],
  template: `

    @if (open()) {
    <div class="modal-backdrop" #backdropEl (click)="_guardedHandler0($event)">
      <div #dialogEl class="modal-dialog" role="dialog" aria-modal="true" [aria-label]="title() || undefined" tabindex="-1">
        @if (title() || headerTpl) {
    <header>
          @if (headerTpl) {
    <ng-container *ngTemplateOutlet="headerTpl; context: { $implicit: { close: _close }, close: _close }" />
    } @else {

            <h2>{{ title() }}</h2>
          
    }
          <button class="close-btn" aria-label="Close" (click)="_close($event)">×</button>
        </header>
    }<div class="modal-body">
          <ng-container *ngTemplateOutlet="defaultTpl; context: { $implicit: { close: _close }, close: _close }" />
          <rozie-counter></rozie-counter>
        </div>

        @if (footerTpl) {
    <footer>
          @if (footerTpl) {
    <ng-container *ngTemplateOutlet="footerTpl; context: { $implicit: { close: _close }, close: _close }" />
    }
        </footer>
    }</div>
    </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: var(--rozie-modal-z, 2000);
    }
    .modal-dialog {
      background: white;
      border-radius: 8px;
      min-width: 20rem;
      max-width: min(90vw, 40rem);
      max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      outline: none;
    }
    header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
    header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
    footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
    .modal-body { padding: 1rem; overflow: auto; }
    .close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }

    ::ng-deep :root {
    --rozie-modal-z: 2000;
    }
  `],
})
export class Modal {
  open = model<boolean>(false);
  closeOnEscape = input<boolean>(true);
  closeOnBackdrop = input<boolean>(true);
  lockBodyScroll = input<boolean>(true);
  title = input<string>('');
  backdropEl = viewChild<ElementRef<HTMLDivElement>>('backdropEl');
  dialogEl = viewChild<ElementRef<HTMLDivElement>>('dialogEl');
  close = output<unknown>();
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open() && this.closeOnEscape())) return;
        const handler = (e: KeyboardEvent) => {
          if (e.key !== 'Escape') return;
          this._close();
        };
        const unlisten = renderer.listen('document', 'keydown', handler);
        onCleanup(unlisten);
      });

    this.lockScroll();
    inject(DestroyRef).onDestroy(this.unlockScroll);
    this.dialogEl()?.nativeElement?.focus();
  }

  _close = () => {
    this.open.set(false);
    this.close.emit();
  };
  savedBodyOverflow = '';
  lockScroll = () => {
    if (!this.lockBodyScroll()) return;
    this.savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  };
  unlockScroll = () => {
    if (!this.lockBodyScroll()) return;
    document.body.style.overflow = this.savedBodyOverflow;
  };

  static ngTemplateContextGuard(
    _dir: Modal,
    _ctx: unknown,
  ): _ctx is HeaderCtx | DefaultCtx | FooterCtx {
    return true;
  }

  private _guardedHandler0 = (e: any) => {
    if (e.target !== e.currentTarget) return;
    this.closeOnBackdrop() && this._close();
  };
}

export default Modal;
```

## Solid output

```tsx
import type { JSX } from 'solid-js';
import { Show, children, createEffect, onCleanup, onMount, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';
import Counter from './Counter';

interface HeaderSlotCtx { close: any; }

interface FooterSlotCtx { close: any; }

interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  onClose?: (...args: unknown[]) => void;
  headerSlot?: (ctx: HeaderSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  footerSlot?: (ctx: FooterSlotCtx) => JSX.Element;
}

export default function Modal(_props: ModalProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['open', 'closeOnEscape', 'closeOnBackdrop', 'lockBodyScroll', 'title', 'children']);
  const resolved = children(() => local.children);

  const [open, setOpen] = createControllableSignal(_props as Record<string, unknown>, 'open', false);
  onMount(() => {
    const _cleanup = (lockScroll)() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(unlockScroll);
  });
  onMount(() => {
    dialogElRef?.focus();
  });
  let backdropElRef: HTMLElement | null = null;
  let dialogElRef: HTMLElement | null = null;

  const close = () => {
    setOpen(false);
    _props.onClose?.();
  };

  // Body-scroll-lock state lives outside reactive data because it tracks DOM
  // rather than UI; managed entirely via lifecycle and listeners.
  // Body-scroll-lock state lives outside reactive data because it tracks DOM
  // rather than UI; managed entirely via lifecycle and listeners.
  let savedBodyOverflow = '';
  const lockScroll = () => {
    if (!local.lockBodyScroll) return;
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  };
  const unlockScroll = () => {
    if (!local.lockBodyScroll) return;
    document.body.style.overflow = savedBodyOverflow;
  };

  // Colocated lifecycle pair — runs in source order alongside other hooks.

  createEffect(() => {
    if (!(open() && local.closeOnEscape)) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
    };
    document.addEventListener('keydown', _rozieHandler);
    onCleanup(() => document.removeEventListener('keydown', _rozieHandler));
  });

  return (
    <>
    <style>{`.modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: var(--rozie-modal-z, 2000);
    }
    .modal-dialog {
      background: white;
      border-radius: 8px;
      min-width: 20rem;
      max-width: min(90vw, 40rem);
      max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      outline: none;
    }
    header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
    header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
    footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
    .modal-body { padding: 1rem; overflow: auto; }
    .close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }`}</style>
    <style>{`:root {
      --rozie-modal-z: 2000;
    }`}</style>
    <>
    {<Show when={open()}><div class={"modal-backdrop"} ref={(el) => { backdropElRef = el as HTMLElement; }} onClick={(e) => { if (e.target !== e.currentTarget) return; local.closeOnBackdrop && close(); }}>
      <div ref={(el) => { dialogElRef = el as HTMLElement; }} class={"modal-dialog"} role="dialog" aria-modal="true" aria-label={local.title || undefined} tabIndex={-1}>
        {<Show when={local.title || _props.headerSlot}><header>
          {_props.headerSlot ? _props.headerSlot({ close }) : <h2>{local.title}</h2>}
          <button aria-label="Close" class={"close-btn"} onClick={close}>×</button>
        </header></Show>}<div class={"modal-body"}>
          {resolved()}
          <Counter />
        </div>

        {<Show when={_props.footerSlot}><footer>
          {_props.footerSlot?.({ close })}
        </footer></Show>}</div>
    </div></Show>}</>
    </>
  );
}
```
