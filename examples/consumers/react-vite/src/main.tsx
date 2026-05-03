import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// `<StrictMode>` is mandatory per success criterion 4 (REACT-T-06).
// Plan 04-05's modal-strictmode.spec.ts e2e test relies on it remaining
// in place — DO NOT remove or wrap conditionally.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
