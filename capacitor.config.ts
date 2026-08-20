import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor-Konfiguration.
 *
 * Nur Android wird gebaut. Die Architektur verbaut iOS aber nicht: alle nativen
 * Zugriffe laufen ueber die Service-Wrapper in `src/services/`, ein spaeteres
 * `npx cap add ios` braucht deshalb keine Umbauten im Spielcode.
 *
 * **`appId` ist nach dem ersten Play-Upload unveraenderlich.**
 */
const config: CapacitorConfig = {
  appId: 'com.bridgelet.game',
  appName: 'Bridgelet',
  webDir: 'dist',
  android: {
    // Kein Overscroll-Glow: das Spielfeld ist nicht scrollbar.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
