import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Basis-Konfiguration fuer Web-Build und Unit-Tests.
// Der Android-Build nimmt exakt dieses Ergebnis aus `dist/` (siehe capacitor.config.ts).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Capacitor laedt die App ueber file:// bzw. den lokalen Scheme -> relative Pfade.
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Performance-Messungen laufen separat ueber vitest.perf.config.ts
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.perf.test.ts'],
  },
});
