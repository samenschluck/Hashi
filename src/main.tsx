import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import { useGameStore } from './state/gameStore.ts';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Wurzelelement #root fehlt in index.html');
}

// Nur im Entwicklungsmodus: gibt automatisierten Oberflaechentests Zugriff auf den
// Spielzustand. Im Produktionsbuild entfaellt der Block vollstaendig.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__bridgelet = useGameStore;
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
