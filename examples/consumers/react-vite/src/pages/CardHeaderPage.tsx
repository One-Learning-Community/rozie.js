import { useState } from 'react';
import type { JSX } from 'react';
import CardHeader from '../CardHeader.rozie';

export default function CardHeaderPage(): JSX.Element {
  const [closeCount, setCloseCount] = useState(0);
  return (
    <div>
      <h2>CardHeader</h2>
      <p>Standalone leaf component — wrapper-pair partner of Card.</p>
      <CardHeader title="Standalone header" onClose={() => setCloseCount((c) => c + 1)} />
      <p>Closes: <span data-testid="card-header-close-count">{closeCount}</span></p>
    </div>
  );
}
