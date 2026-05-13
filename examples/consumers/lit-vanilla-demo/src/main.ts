// Phase 06.4 Plan 03 — lit-vanilla-demo entry point.
//
// The pages/<Name>Page.html files import their own .rozie modules directly
// via <script type="module"> tags. This main.ts is not loaded by index.html
// (which is a static landing page with anchor links) — it exists so the
// `vite dev` server has at least one TS entry to type-check during build.
//
// Importing all 8 .rozie modules eagerly registers every custom element at
// module load, which is useful for the dev-server case where a user lands
// on / and then navigates to a per-page route without a full reload.
import './rozie/Counter.rozie';
import './rozie/SearchInput.rozie';
import './rozie/Dropdown.rozie';
import './rozie/TodoList.rozie';
import './rozie/Modal.rozie';
import './rozie/TreeNode.rozie';
import './rozie/Card.rozie';
import './rozie/CardHeader.rozie';
