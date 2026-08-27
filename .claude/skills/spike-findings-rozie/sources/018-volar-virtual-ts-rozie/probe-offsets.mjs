import { parse } from '/Users/serpentblade/work/olc/rozie/packages/core/dist/index.mjs';
const src = `<rozie>
<props>
{
  label: { type: String, default: 'hi' },
  count: { type: Number, default: 0 },
}
</props>
<data>
{ open: false }
</data>
<script>
function bump() { $data.count = $props.count + 1 }
</script>
<template>
  <button @click="bump()">{{ $props.label }}</button>
</template>
</rozie>`;
const { ast, diagnostics } = parse(src, { filename: 'Probe.rozie' });
console.log('diagnostics:', diagnostics.length);
for (const k of ['props','data','script','template','style']) {
  const b = ast[k];
  if (!b) { console.log(k.padEnd(9), '-> (absent)'); continue; }
  console.log(k.padEnd(9), '-> keys:', Object.keys(b).join(','));
  console.log('          loc:', JSON.stringify(b.loc));
}
console.log('\n--- props block detail ---');
console.log(JSON.stringify(ast.props, null, 2).slice(0, 1400));
