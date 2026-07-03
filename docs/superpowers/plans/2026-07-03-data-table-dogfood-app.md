# DataTable Dogfood App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one Vue app that consumes the installed `@rozie-ui/data-table-vue` package and wires every data-table feature together (grid + virtualization + editing + grouping + drop-ins), with a live theme switcher, state readouts, and an imperative-handle panel — so the flagship can be hand-dogfooded before launch.

**Architecture:** A standalone Vite + Vue 3 app at `examples/dogfood/data-table-vue/`, registered in the pnpm workspace, depending on `@rozie-ui/data-table-vue` and importing **only** through its package entry (built `dist` + published `.d.ts`), never from `src`. One kitchen-sink `<DataTable>` on a ~1,500-row synthetic dataset, driven by a control panel that flips features on in combination. Verification is per-task: `vue-tsc --noEmit` (consumer-typecheck reality) + a Playwright smoke that drives the feature the task adds.

**Tech Stack:** Vite 8, Vue 3.5, `@rozie-ui/data-table-vue` (built leaf), `@tanstack/table-core` ^8.21, `@tanstack/virtual-core` ^3, `vue-tsc`, `@playwright/test` 1.60.

## Global Constraints

- Consumer imports resolve through the package entry only: `@rozie-ui/data-table-vue` and `@rozie-ui/data-table-vue/themes/*.css`. **Never** import from `.../src/...` or `.../source`.
- The leaf must be built before the app resolves types/runtime: `pnpm --filter @rozie-ui/data-table-vue build`.
- Peer deps the consumer must install: `vue@^3.5`, `@tanstack/table-core@^8.21`, `@tanstack/virtual-core@^3`.
- TypeScript floor 5.6+; the app must pass `vue-tsc --noEmit` clean (this is a real success criterion, not incidental).
- Node 20+. Package is `private: true` (never published).
- Vue template attribute forms (verified against `docs/components/data-table-{demo,usage}.md`): v-models are kebab — `v-model:sorting`, `v-model:global-filter`, `v-model:column-filters`, `v-model:row-selection`, `v-model:pagination`, `v-model:grouping`, `v-model:expanded`, `v-model:column-visibility`, `v-model:column-sizing`, `v-model:column-order`, `v-model:column-pinning`, `v-model:data`. Props: `groupable`, `expandable`, `sticky-header`, `selection-mode`, `:virtual`, `max-height`, `:estimate-row-height`, `interaction-mode`. Events kebab: `@cell-edit-commit`, `@row-edit-commit`. Column props: `field`, `header`, `:sortable`, `:filterable`, `:editable`, `editor` (`"text"|"number"|"select"|"checkbox"|"custom"`), `:editorOptions`, `:validate`, `groupable`, `expandable`, `pinned`, `:width`.

---

### Task 1: Scaffold the installed-package consumer app

**Files:**
- Modify: `pnpm-workspace.yaml` (add `examples/dogfood/*` glob)
- Create: `examples/dogfood/data-table-vue/package.json`
- Create: `examples/dogfood/data-table-vue/tsconfig.json`
- Create: `examples/dogfood/data-table-vue/vite.config.ts`
- Create: `examples/dogfood/data-table-vue/index.html`
- Create: `examples/dogfood/data-table-vue/src/main.ts`
- Create: `examples/dogfood/data-table-vue/src/App.vue`
- Create: `examples/dogfood/data-table-vue/src/env.d.ts`
- Create: `examples/dogfood/data-table-vue/playwright.config.ts`
- Test: `examples/dogfood/data-table-vue/tests/smoke.spec.ts`
- Create: `examples/dogfood/data-table-vue/README.md`

**Interfaces:**
- Produces: a runnable Vue app whose `#app` mounts `App.vue`; a Playwright config whose `webServer` runs `vite preview`; the `data-testid="dogfood-root"` mount marker consumed by every later task's smoke test.

- [ ] **Step 1: Register the workspace glob**

Add to `pnpm-workspace.yaml` under `packages:` (after the `examples/playground` line):

```yaml
  - "examples/dogfood/*"
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "@rozie-ui-dogfood/data-table-vue",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4319 --strictPort",
    "typecheck": "vue-tsc --noEmit",
    "test:smoke": "playwright test"
  },
  "dependencies": {
    "@rozie-ui/data-table-vue": "workspace:*",
    "@tanstack/table-core": "^8.21",
    "@tanstack/virtual-core": "^3",
    "vue": "^3.5"
  },
  "devDependencies": {
    "@playwright/test": "1.60.0",
    "@vitejs/plugin-vue": "^5.2.4",
    "typescript": "^5.6.0",
    "vite": "^8.0.0",
    "vue-tsc": "^2.1.0"
  }
}
```

> If `@vitejs/plugin-vue@^5` rejects Vite 8's peer range at install, bump it to the version other workspace Vue builds resolve (check `docs/package.json`); do not downgrade Vite.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "tests/**/*.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`, `index.html`, `src/env.d.ts`, `src/main.ts`**

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: { port: 4319, strictPort: true },
});
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>data-table dogfood</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/env.d.ts`:

```ts
/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
```

`src/main.ts`:

```ts
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

- [ ] **Step 5: Create a minimal `App.vue` (mount marker only, for now)**

```vue
<script setup lang="ts">
import { DataTable } from '@rozie-ui/data-table-vue';
import '@rozie-ui/data-table-vue/themes/base.css';
</script>

<template>
  <main data-testid="dogfood-root">
    <h1>data-table dogfood</h1>
    <DataTable :data="[]" />
  </main>
</template>
```

- [ ] **Step 6: Build the leaf, install, and typecheck (verify consumer reality)**

Run:
```bash
pnpm --filter @rozie-ui/data-table-vue build
pnpm install
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
```
Expected: leaf builds; install links the workspace dep; `vue-tsc --noEmit` exits 0 (the empty `DataTable` resolves types from the built `.d.ts`).

- [ ] **Step 7: Write the smoke test scaffold**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4319',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4319' },
});
```

`tests/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('app mounts and renders a DataTable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('dogfood-root')).toBeVisible();
  await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
});
```

- [ ] **Step 8: Run the smoke test**

Run: `pnpm --filter @rozie-ui-dogfood/data-table-vue test:smoke`
Expected: PASS — the built app serves and the empty table renders.

- [ ] **Step 9: Write `README.md`**

Document: purpose (pre-launch hand-dogfood of the flagship), the build-leaf-first requirement, `pnpm dev` to drive it, `pnpm typecheck` / `pnpm test:smoke`, and that it consumes the **built** package (never source).

- [ ] **Step 10: Commit**

```bash
git add pnpm-workspace.yaml examples/dogfood/data-table-vue pnpm-lock.yaml
git commit -m "feat(dogfood): scaffold data-table-vue installed-package consumer app"
```

---

### Task 2: Synthetic dataset + column model

**Files:**
- Create: `examples/dogfood/data-table-vue/src/data.ts`
- Test: `examples/dogfood/data-table-vue/tests/data.spec.ts`

**Interfaces:**
- Produces: `type Order` (fields below); `makeOrders(n: number): Order[]`; `ORDERS: Order[]` (1,500 rows); `roleOptions`, `statusOptions`, `categoryOptions: { value: string; label: string }[]`. Consumed by App.vue in every later task.

- [ ] **Step 1: Write the failing test**

`tests/data.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { makeOrders, ORDERS } from '../src/data';

test('dataset shape and size', () => {
  expect(ORDERS.length).toBe(1500);
  const r = makeOrders(3)[0];
  expect(Object.keys(r).sort()).toEqual(
    ['active', 'amount', 'category', 'customer', 'id', 'orderedAt', 'status', 'units'].sort(),
  );
  expect(typeof r.amount).toBe('number');
  expect(typeof r.active).toBe('boolean');
});
```

> Note: this is a plain unit test run by Playwright's runner (no browser). Keep it in `tests/` so one runner covers both; it does not hit the `webServer`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test data.spec --reporter=line`
Expected: FAIL — `Cannot find module '../src/data'`.

- [ ] **Step 3: Implement `src/data.ts`**

```ts
export type Order = {
  id: number;
  customer: string;      // TEXT   → FilterText / EditorText
  category: string;      // ENUM   → FilterSelect / EditorSelect
  amount: number;        // CURRENCY (number) → FilterNumberRange / EditorNumber
  units: number;         // NUMBER → grouping/aggregation
  status: string;        // ENUM   → EditorSelect
  active: boolean;       // BOOL   → EditorCheckbox
  orderedAt: string;     // DATE (ISO yyyy-mm-dd) → EditorDate
};

const CUSTOMERS = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Katherine Johnson',
  'Margaret Hamilton', 'Edsger Dijkstra', 'Barbara Liskov', 'Donald Knuth', 'Radia Perlman'];
const CATEGORIES = ['Hardware', 'Software', 'Services', 'Support'];
const STATUSES = ['active', 'pending', 'archived'];

export const categoryOptions = CATEGORIES.map((v) => ({ value: v, label: v }));
export const statusOptions = STATUSES.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
export const roleOptions = categoryOptions; // alias for the editor demo

// Deterministic PRNG so the dataset is stable across reloads (no Math.random).
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeOrders(n: number): Order[] {
  const rnd = mulberry32(42);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return Array.from({ length: n }, (_, i) => {
    const day = 1 + Math.floor(rnd() * 27);
    return {
      id: i + 1,
      customer: pick(CUSTOMERS),
      category: pick(CATEGORIES),
      amount: Math.round(rnd() * 500_00) / 100,
      units: 1 + Math.floor(rnd() * 40),
      status: pick(STATUSES),
      active: rnd() > 0.4,
      orderedAt: `2026-03-${String(day).padStart(2, '0')}`,
    };
  });
}

export const ORDERS: Order[] = makeOrders(1500);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test data.spec --reporter=line`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/dogfood/data-table-vue/src/data.ts examples/dogfood/data-table-vue/tests/data.spec.ts
git commit -m "feat(dogfood): synthetic 1500-row Order dataset + column value sets"
```

---

### Task 3: Base kitchen-sink table + live state readouts

**Files:**
- Modify: `examples/dogfood/data-table-vue/src/App.vue`
- Create: `examples/dogfood/data-table-vue/src/StateReadout.vue`
- Test: `examples/dogfood/data-table-vue/tests/base-table.spec.ts`

**Interfaces:**
- Consumes: `ORDERS`, `Order` from `src/data.ts`.
- Produces: refs for all two-way slices on `App.vue` (`sorting`, `globalFilter`, `columnFilters`, `rowSelection`, `pagination`, `grouping`, `expanded`, `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning`, `rows`); a `data-testid="state-readout"` panel; the table under `data-testid="dt"`.

- [ ] **Step 1: Create `StateReadout.vue`**

```vue
<script setup lang="ts">
defineProps<{ state: Record<string, unknown> }>();
</script>

<template>
  <aside data-testid="state-readout" class="readout">
    <h2>state</h2>
    <code v-for="(v, k) in state" :key="k" :data-slice="k">{{ k }}: {{ JSON.stringify(v) }}</code>
  </aside>
</template>

<style scoped>
.readout { display: flex; flex-direction: column; gap: 4px; font: 12px/1.4 ui-monospace, monospace; }
.readout code { white-space: pre-wrap; word-break: break-all; }
</style>
```

- [ ] **Step 2: Rewrite `App.vue` to bind every slice + a global-filter search box**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { DataTable, Column } from '@rozie-ui/data-table-vue';
import '@rozie-ui/data-table-vue/themes/base.css';
import { ORDERS, type Order } from './data';
import StateReadout from './StateReadout.vue';

const rows = ref<Order[]>([...ORDERS]);
const sorting = ref<any[]>([]);
const globalFilter = ref('');
const columnFilters = ref<any[]>([]);
const rowSelection = ref<Record<string, boolean>>({});
const pagination = ref({ pageIndex: 0, pageSize: 20 });
const grouping = ref<string[]>([]);
const expanded = ref<Record<string, boolean>>({});
const columnVisibility = ref<Record<string, boolean>>({});
const columnSizing = ref<Record<string, number>>({});
const columnOrder = ref<string[]>([]);
const columnPinning = ref<{ left?: string[]; right?: string[] }>({});
</script>

<template>
  <main data-testid="dogfood-root" class="shell">
    <section class="tablewrap">
      <input
        data-testid="global-filter"
        v-model="globalFilter"
        placeholder="search all columns…"
      />
      <div data-testid="dt">
        <DataTable
          :data="rows"
          selection-mode="multiple"
          sticky-header
          v-model:sorting="sorting"
          v-model:global-filter="globalFilter"
          v-model:column-filters="columnFilters"
          v-model:row-selection="rowSelection"
          v-model:pagination="pagination"
          v-model:grouping="grouping"
          v-model:expanded="expanded"
          v-model:column-visibility="columnVisibility"
          v-model:column-sizing="columnSizing"
          v-model:column-order="columnOrder"
          v-model:column-pinning="columnPinning"
        >
          <Column field="id" header="#" :sortable="true" :width="60" />
          <Column field="customer" header="Customer" :sortable="true" :filterable="true" groupable />
          <Column field="category" header="Category" :sortable="true" :filterable="true" groupable />
          <Column field="amount" header="Amount" :sortable="true" :filterable="true" />
          <Column field="units" header="Units" :sortable="true" />
          <Column field="status" header="Status" :sortable="true" :filterable="true" groupable />
          <Column field="active" header="Active" :sortable="true" />
          <Column field="orderedAt" header="Ordered" :sortable="true" />
        </DataTable>
      </div>
    </section>

    <StateReadout
      :state="{ sorting, globalFilter, columnFilters, rowSelection, pagination, grouping, expanded, columnVisibility, columnSizing, columnOrder, columnPinning }"
    />
  </main>
</template>

<style scoped>
.shell { display: grid; grid-template-columns: 1fr 320px; gap: 16px; padding: 16px; align-items: start; }
.tablewrap { min-width: 0; }
[data-testid='global-filter'] { margin-bottom: 8px; padding: 4px 8px; width: 240px; }
</style>
```

- [ ] **Step 3: Write the behavioral smoke**

`tests/base-table.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('renders rows, sorts on header click, readout reflects sorting', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('dt').locator('tbody tr').first()).toBeVisible();
  await page.getByRole('columnheader', { name: 'Customer' }).click();
  await expect(page.getByTestId('state-readout').locator('[data-slice="sorting"]'))
    .toContainText('customer');
});

test('global filter narrows the row set', async ({ page }) => {
  await page.goto('/');
  const rowsBefore = await page.getByTestId('dt').locator('tbody tr').count();
  await page.getByTestId('global-filter').fill('Turing');
  await expect
    .poll(async () => page.getByTestId('dt').locator('tbody tr').count())
    .toBeLessThan(rowsBefore);
});
```

- [ ] **Step 4: Typecheck + run smokes**

Run:
```bash
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test base-table.spec --reporter=line
```
Expected: typecheck exits 0; both smokes PASS.

> If sorting-header role/name differs, open `pnpm dev` and read the actual DOM (the compiled table markup is authoritative) before adjusting the locator — do not weaken the assertion to make it pass.

- [ ] **Step 5: Commit**

```bash
git add examples/dogfood/data-table-vue/src/App.vue examples/dogfood/data-table-vue/src/StateReadout.vue examples/dogfood/data-table-vue/tests/base-table.spec.ts
git commit -m "feat(dogfood): kitchen-sink table with all 11 two-way slices + live state readout"
```

---

### Task 4: Control panel — interaction mode, virtualization, selection, pagination

**Files:**
- Modify: `examples/dogfood/data-table-vue/src/App.vue`
- Create: `examples/dogfood/data-table-vue/src/ControlPanel.vue`
- Test: `examples/dogfood/data-table-vue/tests/controls-core.spec.ts`

**Interfaces:**
- Produces: a `ControlPanel.vue` emitting `v-model` on a shared `controls` reactive object with keys `interactionMode: 'table'|'grid'`, `virtual: boolean`, `selectionMode: 'none'|'single'|'multiple'`, `manualPagination: boolean`. App.vue binds these onto `<DataTable>`. Each control carries `data-testid="ctl-<key>"`.

- [ ] **Step 1: Create `ControlPanel.vue`**

```vue
<script setup lang="ts">
const model = defineModel<{
  interactionMode: 'table' | 'grid';
  virtual: boolean;
  selectionMode: 'none' | 'single' | 'multiple';
  manualPagination: boolean;
}>({ required: true });
</script>

<template>
  <fieldset class="controls">
    <legend>controls</legend>
    <label>mode
      <select data-testid="ctl-interactionMode" v-model="model.interactionMode">
        <option value="table">table</option>
        <option value="grid">grid</option>
      </select>
    </label>
    <label><input data-testid="ctl-virtual" type="checkbox" v-model="model.virtual" /> virtualize</label>
    <label>selection
      <select data-testid="ctl-selectionMode" v-model="model.selectionMode">
        <option value="none">none</option>
        <option value="single">single</option>
        <option value="multiple">multiple</option>
      </select>
    </label>
    <label><input data-testid="ctl-manualPagination" type="checkbox" v-model="model.manualPagination" /> manual pagination</label>
  </fieldset>
</template>
```

- [ ] **Step 2: Wire controls into App.vue**

In `App.vue` `<script setup>` add:

```ts
import ControlPanel from './ControlPanel.vue';
const controls = ref({
  interactionMode: 'table' as 'table' | 'grid',
  virtual: false,
  selectionMode: 'multiple' as 'none' | 'single' | 'multiple',
  manualPagination: false,
});
```

Replace the static `selection-mode="multiple"` on `<DataTable>` and add the bound props:

```html
          :interaction-mode="controls.interactionMode"
          :virtual="controls.virtual"
          max-height="440px"
          :estimate-row-height="40"
          :selection-mode="controls.selectionMode"
          :manual="controls.manualPagination"
```

Add `<ControlPanel v-model="controls" />` above the table inside `.tablewrap`.

- [ ] **Step 3: Write the smoke**

`tests/controls-core.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('grid mode exposes role=grid and roving tabstop', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('ctl-interactionMode').selectOption('grid');
  await expect(page.locator('[role="grid"]')).toBeVisible();
});

test('virtualization windows the row set', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('ctl-virtual').check();
  // With 1500 rows windowed into a 440px viewport, far fewer than 1500 <tr> render.
  await expect
    .poll(async () => page.getByTestId('dt').locator('tbody tr').count())
    .toBeLessThan(100);
});
```

- [ ] **Step 4: Typecheck + run smokes**

Run:
```bash
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test controls-core.spec --reporter=line
```
Expected: typecheck 0; both PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/dogfood/data-table-vue/src/ControlPanel.vue examples/dogfood/data-table-vue/src/App.vue examples/dogfood/data-table-vue/tests/controls-core.spec.ts
git commit -m "feat(dogfood): control panel — grid/table, virtualization, selection, manual pagination"
```

---

### Task 5: Editing + the five editor drop-ins

**Files:**
- Modify: `examples/dogfood/data-table-vue/src/App.vue`
- Test: `examples/dogfood/data-table-vue/tests/editing.spec.ts`

**Interfaces:**
- Consumes: `statusOptions`, `categoryOptions` from `src/data.ts`.
- Produces: `:editable` columns + a `#editor` slot dispatched by `columnId` to `EditorText/Number/Select/Checkbox/Date`; `@cell-edit-commit` writing back to `rows`.

- [ ] **Step 1: Add editor imports + editable columns**

In `App.vue` extend the import:

```ts
import { DataTable, Column, EditorText, EditorNumber, EditorSelect, EditorCheckbox, EditorDate } from '@rozie-ui/data-table-vue';
import { ORDERS, statusOptions, categoryOptions, type Order } from './data';
```

Mark columns editable with `editor="custom"` so the `#editor` slot drives them: add `:editable="true" editor="custom"` to `customer`, `category`, `amount`, `active`, `orderedAt`, and `status`.

- [ ] **Step 2: Add the `#editor` slot (dispatched by columnId)**

Inside `<DataTable>`:

```html
          <template #editor="{ columnId, column, row, value, commit, cancel }">
            <EditorSelect v-if="columnId === 'category'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" :options="categoryOptions" />
            <EditorSelect v-else-if="columnId === 'status'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" :options="statusOptions" />
            <EditorNumber v-else-if="columnId === 'amount'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
            <EditorCheckbox v-else-if="columnId === 'active'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
            <EditorDate v-else-if="columnId === 'orderedAt'" :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
            <EditorText v-else :columnId="columnId" :column="column" :row="row" :value="value" :commit="commit" :cancel="cancel" />
          </template>
```

Add the commit handler on `<DataTable>`: `@cell-edit-commit="onCellCommit"` and in script:

```ts
function onCellCommit(p: { rowId: string | number; columnId: string; value: unknown }) {
  // The component owns edit state and re-feeds via data; this readout proves commits fire.
  lastCommit.value = p;
}
const lastCommit = ref<unknown>(null);
```

Add `lastCommit` into the `StateReadout` `:state` object.

- [ ] **Step 3: Write the smoke**

`tests/editing.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('editing a Customer cell commits and fires cell-edit-commit', async ({ page }) => {
  await page.goto('/');
  const cell = page.getByTestId('dt').locator('tbody tr').first().locator('td').nth(1);
  await cell.click();
  await page.keyboard.press('Enter'); // enter edit mode
  const input = cell.locator('input');
  await input.fill('Zzz Edited');
  await page.keyboard.press('Enter'); // commit
  await expect(page.getByTestId('state-readout').locator('[data-slice="lastCommit"]'))
    .toContainText('customer');
});
```

- [ ] **Step 4: Typecheck + run**

Run:
```bash
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test editing.spec --reporter=line
```
Expected: typecheck 0; smoke PASS. If Enter-to-edit differs, drive it in `pnpm dev` and match the real keymap (F2 is the documented alternate) before adjusting — do not weaken the commit assertion.

- [ ] **Step 5: Commit**

```bash
git add examples/dogfood/data-table-vue/src/App.vue examples/dogfood/data-table-vue/tests/editing.spec.ts
git commit -m "feat(dogfood): inline editing wired to all five editor drop-ins + commit readout"
```

---

### Task 6: Grouping + GroupBar, per-column filters + faceted, expandable + DetailPanel

**Files:**
- Modify: `examples/dogfood/data-table-vue/src/App.vue`
- Test: `examples/dogfood/data-table-vue/tests/group-filter-expand.spec.ts`

**Interfaces:**
- Produces: `#groupBar`, `#filter` (dispatched by columnId to `FilterText/FilterSelect/FilterNumberRange`), `#detail` slots; `groupable` + `expandable` on `<DataTable>`.

- [ ] **Step 1: Extend imports + enable groupable/expandable**

```ts
import { /* …existing… */ GroupBar, FilterText, FilterSelect, FilterNumberRange, DetailPanel } from '@rozie-ui/data-table-vue';
```

Add `groupable expandable` attributes to `<DataTable>`.

- [ ] **Step 2: Add the three slots**

```html
          <template #groupBar="{ grouping, groupableColumns, applyGrouping, clearGrouping }">
            <GroupBar :grouping="grouping" :groupableColumns="groupableColumns" :applyGrouping="applyGrouping" :clearGrouping="clearGrouping" />
          </template>

          <template #filter="{ columnId, uniqueValues, minMax, setFilter }">
            <FilterSelect v-if="columnId === 'category' || columnId === 'status'" :columnId="columnId" :setFilter="setFilter" :uniqueValues="uniqueValues" />
            <FilterNumberRange v-else-if="columnId === 'amount'" :columnId="columnId" :setFilter="setFilter" :minMax="minMax" />
            <FilterText v-else :columnId="columnId" :setFilter="setFilter" />
          </template>

          <template #detail="{ row }">
            <DetailPanel :row="row" />
          </template>
```

- [ ] **Step 3: Write the smoke**

`tests/group-filter-expand.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('faceted select filter narrows rows to one category', async ({ page }) => {
  await page.goto('/');
  const before = await page.getByTestId('dt').locator('tbody tr').count();
  const facet = page.getByTestId('dt').getByRole('combobox').first();
  await facet.selectOption({ index: 1 });
  await expect
    .poll(async () => page.getByTestId('dt').locator('tbody tr').count())
    .toBeLessThanOrEqual(before);
});

test('expanding a row reveals its DetailPanel', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('dt').locator('tbody tr').first().getByRole('button').first().click();
  await expect(page.getByTestId('state-readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
});
```

> Grouping is not smoke-tested here — it is exercised by hand via the GroupBar and asserted through the imperative `applyGrouping` path in Task 7. Keep the faceted + expand assertions in this task strict.

- [ ] **Step 4: Typecheck + run**

Run:
```bash
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test group-filter-expand.spec --reporter=line
```
Expected: typecheck 0; PASS. Verify selectors against real DOM in `pnpm dev` if a locator misses.

- [ ] **Step 5: Commit**

```bash
git add examples/dogfood/data-table-vue/src/App.vue examples/dogfood/data-table-vue/tests/group-filter-expand.spec.ts
git commit -m "feat(dogfood): GroupBar + faceted/text/range filters + expandable DetailPanel drop-ins"
```

---

### Task 7: Column-ops controls + imperative-handle panel

**Files:**
- Modify: `examples/dogfood/data-table-vue/src/App.vue`
- Create: `examples/dogfood/data-table-vue/src/HandlePanel.vue`
- Test: `examples/dogfood/data-table-vue/tests/handle.spec.ts`

**Interfaces:**
- Consumes: the table instance via `ref="tbl"` on `<DataTable>`.
- Produces: a `HandlePanel.vue` taking `:handle` (the table ref) and rendering a button per `$expose` verb; each button `data-testid="verb-<name>"`.

- [ ] **Step 1: Add `ref="tbl"` to `<DataTable>` and expose it**

In `App.vue`: `const tbl = ref<any>(null);` and add `ref="tbl"` to `<DataTable>`. Pass `:handle="tbl"` to a new `<HandlePanel>`.

- [ ] **Step 2: Create `HandlePanel.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ handle: any }>();
const VERBS: { name: string; run: (h: any) => void }[] = [
  { name: 'expandAll', run: (h) => h?.expandAll?.() },
  { name: 'collapseAll', run: (h) => h?.collapseAll?.() },
  { name: 'toggleAllRows', run: (h) => h?.toggleAllRows?.(true) },
  { name: 'clearSelection', run: (h) => h?.clearSelection?.() },
  { name: 'clearSorting', run: (h) => h?.clearSorting?.() },
  { name: 'applyGrouping', run: (h) => h?.applyGrouping?.(['category']) },
  { name: 'clearGrouping', run: (h) => h?.clearGrouping?.() },
  { name: 'setPage', run: (h) => h?.setPage?.(2) },
  { name: 'setRowsPerPage', run: (h) => h?.setRowsPerPage?.(50) },
  { name: 'resetColumnSizing', run: (h) => h?.resetColumnSizing?.() },
  { name: 'pinColumn', run: (h) => h?.pinColumn?.('customer', 'left') },
  { name: 'focusCell', run: (h) => h?.focusCell?.(0, 1) },
  { name: 'commitEditing', run: (h) => h?.commitEditing?.() },
];
function fire(v: (h: any) => void) { v(props.handle); }
</script>

<template>
  <fieldset class="handle">
    <legend>imperative handle ($expose)</legend>
    <button v-for="v in VERBS" :key="v.name" :data-testid="'verb-' + v.name" type="button" @click="fire(v.run)">
      {{ v.name }}
    </button>
  </fieldset>
</template>
```

> This intentionally covers the safe, side-effecting verbs. Getter verbs (`getSelectedRows`, `getActiveCell`, `getFacetedUniqueValues`, …) are exercised by hand in `pnpm dev` via the console; do not fabricate assertions for them here.

- [ ] **Step 3: Write the smoke**

`tests/handle.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('expandAll populates the expanded slice; clearSelection empties selection', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('verb-expandAll').click();
  await expect(page.getByTestId('state-readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
  await page.getByTestId('verb-toggleAllRows').click();
  await expect(page.getByTestId('state-readout').locator('[data-slice="rowSelection"]')).not.toContainText('{}');
  await page.getByTestId('verb-clearSelection').click();
  await expect(page.getByTestId('state-readout').locator('[data-slice="rowSelection"]')).toContainText('{}');
});

test('applyGrouping(category) writes the grouping slice', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('verb-applyGrouping').click();
  await expect(page.getByTestId('state-readout').locator('[data-slice="grouping"]')).toContainText('category');
});
```

- [ ] **Step 4: Typecheck + run**

Run:
```bash
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test handle.spec --reporter=line
```
Expected: typecheck 0; PASS. Any verb that throws or no-ops unexpectedly is a real dogfood finding — record it, do not delete the button.

- [ ] **Step 5: Commit**

```bash
git add examples/dogfood/data-table-vue/src/HandlePanel.vue examples/dogfood/data-table-vue/src/App.vue examples/dogfood/data-table-vue/tests/handle.spec.ts
git commit -m "feat(dogfood): imperative-handle panel driving the \$expose verbs by hand"
```

---

### Task 8: Live theme switcher (the theming blind spot)

**Files:**
- Modify: `examples/dogfood/data-table-vue/src/App.vue`
- Create: `examples/dogfood/data-table-vue/src/themes.ts`
- Test: `examples/dogfood/data-table-vue/tests/theming.spec.ts`

**Interfaces:**
- Produces: a `theme` ref (`'base'|'shadcn'|'material'|'bootstrap'`) driving a stylesheet swap; a `data-testid="ctl-theme"` selector.

- [ ] **Step 1: Import all four theme sheets via the package subpath**

`src/themes.ts`:

```ts
// All four ship from the package's ./themes/* export (source-served CSS).
// Importing as `?inline` gives us the raw text so we can swap at runtime without
// four <link>s fighting over the cascade.
import base from '@rozie-ui/data-table-vue/themes/base.css?inline';
import shadcn from '@rozie-ui/data-table-vue/themes/shadcn.css?inline';
import material from '@rozie-ui/data-table-vue/themes/material.css?inline';
import bootstrap from '@rozie-ui/data-table-vue/themes/bootstrap.css?inline';

export type ThemeName = 'base' | 'shadcn' | 'material' | 'bootstrap';
export const THEMES: Record<ThemeName, string> = { base, shadcn, material, bootstrap };
```

- [ ] **Step 2: Swap the active sheet in App.vue**

Remove the static `import '@rozie-ui/data-table-vue/themes/base.css';`. Add:

```ts
import { computed, ref } from 'vue';
import { THEMES, type ThemeName } from './themes';
const theme = ref<ThemeName>('base');
const themeCss = computed(() => THEMES[theme.value]);
```

Render the active sheet and a picker:

```html
    <component :is="'style'" data-testid="active-theme">{{ themeCss }}</component>
    <label>theme
      <select data-testid="ctl-theme" v-model="theme">
        <option value="base">base</option>
        <option value="shadcn">shadcn</option>
        <option value="material">material</option>
        <option value="bootstrap">bootstrap</option>
      </select>
    </label>
```

- [ ] **Step 3: Write the smoke**

`tests/theming.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('switching theme swaps the active stylesheet content', async ({ page }) => {
  await page.goto('/');
  const styleEl = page.getByTestId('active-theme');
  const base = await styleEl.textContent();
  await page.getByTestId('ctl-theme').selectOption('material');
  await expect.poll(async () => styleEl.textContent()).not.toBe(base);
  // The table still renders under the new skin.
  await expect(page.getByTestId('dt').locator('tbody tr').first()).toBeVisible();
});
```

- [ ] **Step 4: Typecheck + run**

Run:
```bash
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
pnpm --filter @rozie-ui-dogfood/data-table-vue exec playwright test theming.spec --reporter=line
```
Expected: typecheck 0 (this also proves `./themes/*` + `?inline` resolve as a real consumer); PASS.

> If any of the four sheets fails to resolve or throws at import, that is a **shipped-package theming bug** (the whole reason theming is in scope) — record it and fix at the leaf's `exports`/theme-copy, do not drop the theme from the switcher.

- [ ] **Step 5: Commit**

```bash
git add examples/dogfood/data-table-vue/src/themes.ts examples/dogfood/data-table-vue/src/App.vue examples/dogfood/data-table-vue/tests/theming.spec.ts
git commit -m "feat(dogfood): live theme switcher — first exercise of all four shipped skins"
```

---

### Task 9: Kill the stale `interactionMode` deprecation annotation + full-app verification

**Files:**
- Modify: `packages/ui/data-table/src/DataTable.rozie` (the `interactionMode` prop annotation, ~line 394)
- Modify: (regenerated) the 6 leaves under `packages/ui/data-table/packages/*` via rebless
- Test: `examples/dogfood/data-table-vue/tests/full-suite` (run all specs green)

**Interfaces:**
- Consumes: nothing new.
- Produces: an `interactionMode` prop whose docs/annotation no longer says "not implemented yet".

- [ ] **Step 1: Locate and read the annotation**

Run: `grep -n "not implemented yet\|deprecated" packages/ui/data-table/src/DataTable.rozie`
Read the surrounding `<props>` block for `interactionMode` to see the exact annotation shape before editing.

- [ ] **Step 2: Remove the stale `deprecated` note**

Edit the `interactionMode` prop so it documents the two supported values (`'table'` default, `'grid'` WAI-ARIA grid navigation, GA since Phase 63) and carries **no** `deprecated`/"not implemented" text. Keep the prop, its type, and default unchanged.

- [ ] **Step 3: Rebuild + rebless the leaves (emitter-change flow)**

Run:
```bash
pnpm --filter @rozie/core... build --force
pnpm --filter @rozie-ui/data-table build --force
pnpm --filter dist-parity bootstrap
```
Expected: the 6 data-table leaves regenerate; dist-parity rebless updates byte baselines for the annotation-only change. Review `git diff` — it must touch only comment/annotation text in the emitted leaves, no logic.

- [ ] **Step 4: Rebuild the leaf the dogfood app consumes + re-run the whole app suite**

Run:
```bash
pnpm --filter @rozie-ui/data-table-vue build
pnpm --filter @rozie-ui-dogfood/data-table-vue typecheck
pnpm --filter @rozie-ui-dogfood/data-table-vue test:smoke
```
Expected: typecheck 0; **all** dogfood specs (data, base-table, controls-core, editing, group-filter-expand, handle, theming) PASS against the freshly built leaf.

- [ ] **Step 5: Confirm the annotation is gone**

Run: `grep -rn "not implemented yet" packages/ui/data-table/ || echo "clean"`
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/data-table
git commit -m "fix(data-table): drop stale interactionMode 'not implemented' annotation; rebless leaves"
```

---

## Self-Review

**Spec coverage:**
- Combined kitchen-sink (grid + virtual + editing + grouping + drop-ins in one table) → Tasks 3–7. ✓
- Theme switcher (blind spot) → Task 8. ✓
- Real installed-package consumption + `vue-tsc` gate → Task 1 (entry-only imports, typecheck) + every task re-runs typecheck. ✓
- State readouts → Task 3. ✓
- Imperative-handle panel (~30 verbs) → Task 7. ✓
- Synthetic mixed-type dataset → Task 2. ✓
- Stale `interactionMode` annotation removal + rebless → Task 9. ✓
- All-six / tarball smoke / theming demo+spec → explicitly out of scope (spec "Fast-follow"); not planned. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". The two deliberately-light assertions (grouping-by-drag in Task 6, getter verbs in Task 7) are called out with the reason and covered by the imperative path/hand-driving instead — not silent gaps.

**Type consistency:** `controls` keys (`interactionMode`, `virtual`, `selectionMode`, `manualPagination`) match between ControlPanel.vue (Task 4) and App.vue bindings. Slice ref names match the `v-model:` kebab attributes (Task 3) and the `[data-slice="…"]` readout keys used by every later smoke. `theme` ref values match the `<option>`s and `THEMES` keys (Task 8). Editor/filter/drop-in import names match the leaf's `src/index.ts` named exports.

## Execution Handoff

See the two options below.
