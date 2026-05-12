<script setup>
import { ref } from 'vue';
import Card from '../../examples/Card.rozie';

const closeCount = ref(0);
function handleClose() {
  closeCount.value++;
}
</script>

# Card (with CardHeader)

A wrapper-pair. `Card.rozie` declares `CardHeader` in its `<components>` block and renders `<CardHeader title=... :on-close=... />` at the top of its template; the rest of the body comes from a default slot.

## Live demo

The X button only renders because we passed an `onClose` handler — `CardHeader` does `r-if="$props.onClose"` on its close button.

<ClientOnly>
  <Card title="Hello from Rozie" :on-close="handleClose">
    <p>This is the body. The header bar above is rendered by <code>CardHeader.rozie</code>, resolved through Card's <code>&lt;components&gt;</code> block.</p>
    <p>Close clicked {{ closeCount }} time{{ closeCount === 1 ? '' : 's' }}.</p>
  </Card>
</ClientOnly>

Each target picks its idiomatic import + child-tag form for the cross-component reference:
- **Vue / Svelte** — import with the target extension (`./CardHeader.vue`, `./CardHeader.svelte`).
- **React / Solid** — bare-path import (`./CardHeader`).
- **Angular** — named import + class added to `@Component({ imports: [...] })`, and the `<CardHeader>` tag rewritten to selector form `<rozie-card-header>`.

Note the auto kebab/camel conversion: the source writes `:on-close="$props.onClose"`, and each emitter reconciles that against the `onClose` prop declaration in the appropriate per-target idiom.

---

## Card — source

```rozie
<rozie name="Card">

<components>
{
  CardHeader: './CardHeader.rozie',
}
</components>

<props>
{
  title: { type: String, default: '' },
  onClose: { type: Function, default: null },
}
</props>

<template>
<article class="card">
  <CardHeader :title="$props.title" :on-close="$props.onClose" />
  <div class="card__body">
    <slot />
  </div>
</article>
</template>

<style>
.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body { padding: 1rem; }
</style>

</rozie>
```

### Card — Vue output

```vue
<template>

<article class="card">
  <CardHeader :title="props.title" :on-close="props.onClose"></CardHeader>
  <div class="card__body">
    <slot></slot>
  </div>
</article>

</template>

<script setup lang="ts">
import CardHeader from './CardHeader.vue';

const props = withDefaults(
  defineProps<{ title?: string; onClose?: (...args: any[]) => any }>(),
  { title: '', onClose: null }
);

defineSlots<{
  default(props: {  }): any;
}>();
</script>

<style scoped>
.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body { padding: 1rem; }
</style>
```

### Card — React output

```tsx
import type { ReactNode } from 'react';
import styles from './Card.module.css';
import CardHeader from './CardHeader';

interface CardProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
  children?: ReactNode;
}

export default function Card(_props: CardProps): JSX.Element {
  const props: CardProps = {
    ..._props,
    title: _props.title ?? '',
    onClose: _props.onClose ?? null,
  };

  return (
    <>
    <article className={styles.card}>
      <CardHeader title={props.title} onClose={props.onClose} />
      <div className={styles.card__body}>
        {props.children}
      </div>
    </article>
    </>
  );
}
```

### Card — Svelte output

```svelte
<script lang="ts">
import CardHeader from './CardHeader.svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  onClose?: (...args: any[]) => any;
  children?: Snippet;
}

let {
  title = '',
  onClose = null,
  children,
}: Props = $props();
</script>


<article class="card">
  <CardHeader title={title} on-close={onClose}></CardHeader>
  <div class="card__body">
    {@render children?.()}
  </div>
</article>


<style>
.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body { padding: 1rem; }
</style>
```

### Card — Angular output

```ts
import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CardHeader } from './CardHeader';

interface DefaultCtx {}

@Component({
  selector: 'rozie-card',
  standalone: true,
  imports: [NgTemplateOutlet, CardHeader],
  template: `

    <article class="card">
      <rozie-card-header [title]="title()" [onClose]="onClose()"></rozie-card-header>
      <div class="card__body">
        <ng-container *ngTemplateOutlet="defaultTpl" />
      </div>
    </article>

  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
    .card__body { padding: 1rem; }
  `],
})
export class Card {
  title = input<string>('');
  onClose = input<(...args: unknown[]) => unknown>(null);
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;

  static ngTemplateContextGuard(
    _dir: Card,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }
}

export default Card;
```

### Card — Solid output

```tsx
import type { JSX } from 'solid-js';
import { children, splitProps } from 'solid-js';
import CardHeader from './CardHeader';

interface CardProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
}

export default function Card(_props: CardProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['title', 'onClose', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    <style>{`.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
    .card__body { padding: 1rem; }`}</style>
    <>
    <article class={"card"}>
      <CardHeader title={local.title} onClose={local.onClose} />
      <div class={"card__body"}>
        {resolved()}
      </div>
    </article>
    </>
    </>
  );
}
```

---

## CardHeader — source

A tiny leaf component (~30 lines) — no `<components>` block, no slots, no lifecycle. Stands alone and is consumed by Card. Worth seeing because the contrast with Card highlights the cost-of-features model: leaves are cheap, only components that actually need composition/listeners/refs pay for them.

```rozie
<rozie name="CardHeader">

<props>
{
  title:    { type: String,  default: '' },
  onClose:  { type: Function, default: null },
}
</props>

<template>
<header class="card-header">
  <h3 class="card-header__title">{{ $props.title }}</h3>
  <button r-if="$props.onClose" class="card-header__close" @click="$props.onClose">×</button>
</header>
</template>

<style>
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
.card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
.card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
</style>

</rozie>
```

### CardHeader — Vue output

```vue
<template>

<header class="card-header">
  <h3 class="card-header__title">{{ props.title }}</h3>
  <button v-if="props.onClose" class="card-header__close" @click="props.onClose">×</button></header>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title?: string; onClose?: (...args: any[]) => any }>(),
  { title: '', onClose: null }
);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
.card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
.card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
</style>
```

### CardHeader — React output

```tsx
import styles from './CardHeader.module.css';

interface CardHeaderProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
}

export default function CardHeader(_props: CardHeaderProps): JSX.Element {
  const props: CardHeaderProps = {
    ..._props,
    title: _props.title ?? '',
    onClose: _props.onClose ?? null,
  };

  return (
    <>
    <header className={styles["card-header"]}>
      <h3 className={styles["card-header__title"]}>{props.title}</h3>
      {(props.onClose) && <button className={styles["card-header__close"]} onClick={(e) => { props.onClose; }}>×</button>}</header>
    </>
  );
}
```

### CardHeader — Svelte output

```svelte
<script lang="ts">
interface Props {
  title?: string;
  onClose?: (...args: any[]) => any;
}

let { title = '', onClose = null }: Props = $props();
</script>


<header class="card-header">
  <h3 class="card-header__title">{title}</h3>
  {#if onClose}<button class="card-header__close" onclick={(e) => { (onClose)(e); }}>×</button>{/if}</header>


<style>
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
.card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
.card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
</style>
```

### CardHeader — Angular output

```ts
import { Component, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'rozie-card-header',
  standalone: true,
  template: `

    <header class="card-header">
      <h3 class="card-header__title">{{ title() }}</h3>
      @if (onClose()) {
    <button class="card-header__close" (click)="(onClose())($event)">×</button>
    }</header>

  `,
  styles: [`
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    .card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
    .card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
  `],
})
export class CardHeader {
  title = input<string>('');
  onClose = input<(...args: unknown[]) => unknown>(null);
}

export default CardHeader;
```

### CardHeader — Solid output

```tsx
import type { JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';

interface CardHeaderProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
}

export default function CardHeader(_props: CardHeaderProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['title', 'onClose']);

  return (
    <>
    <style>{`.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    .card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
    .card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }`}</style>
    <>
    <header class={"card-header"}>
      <h3 class={"card-header__title"}>{local.title}</h3>
      {<Show when={local.onClose}><button class={"card-header__close"} onClick={(e) => { local.onClose; }}>×</button></Show>}</header>
    </>
    </>
  );
}
```
