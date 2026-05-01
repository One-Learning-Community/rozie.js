// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-04 fills these in.
//
// MOD-04 key/button filters — .escape, .enter, .tab, arrow keys, mouse
// buttons (.left, .right, .middle), system keys (.ctrl, .shift, .alt, .meta).
import { describe, it } from 'vitest';

describe('builtin: key filters — Plan 02-04', () => {
  it.todo('.escape → ModifierPipelineEntry { kind: "filter", modifier: "escape", args: [] }');
  it.todo('.enter → ModifierPipelineEntry { kind: "filter", modifier: "enter", args: [] }');
  it.todo('.tab → ModifierPipelineEntry { kind: "filter", modifier: "tab", args: [] }');
  it.todo('.left (mouse button) → filter entry with modifier: "left"');
  it.todo('.right (mouse button) → filter entry with modifier: "right"');
  it.todo('.ctrl.shift → two separate filter entries (system key combination)');
});
