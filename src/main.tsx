import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Wurzelelement #root fehlt in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
