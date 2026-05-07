import { useState } from 'react';
import Card from '../Card.rozie';

export default function CardPage(): JSX.Element {
  const [closeCount, setCloseCount] = useState(0);
  return (
    <div>
      <h2>Card</h2>
      <p>Wrapper composition (D-119) — Card embeds CardHeader and renders default-slot content.</p>
      <Card title="Hello world" onClose={() => setCloseCount((c) => c + 1)}>
        <p>This body lives in Card's default slot.</p>
        <p>Closes: <span data-testid="card-close-count">{closeCount}</span></p>
      </Card>
    </div>
  );
}
