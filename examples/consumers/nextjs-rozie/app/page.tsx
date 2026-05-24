'use client';

// 'use client' because Rozie-compiled React components use hooks
// (useState / useMemo / useEffect) and React Server Components forbid
// them. The doc walkthrough notes this is the standard pattern for
// interactive components inside an App Router page.

import { useState } from 'react';
import Counter from './Counter.rozie';

export default function Page() {
  const [count, setCount] = useState(0);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Rozie + Next.js</h1>
      <p>This page imports a .rozie file that compiled to React via @rozie/unplugin/webpack.</p>
      <Counter value={count} onValueChange={setCount} step={2} />
    </main>
  );
}
