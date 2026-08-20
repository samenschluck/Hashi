import { App } from '@capacitor/app';
import { isNativePlatform } from './platform.ts';

/**
 * Android-Lebenszyklus als Service-Wrapper.
 *
 * Im Browser gibt es kein Aequivalent zum Zurueck-Knopf; dort wird stattdessen
 * die History benutzt, und Pause/Fortsetzen kommt aus `visibilitychange`.
 * Alle Rueckgabewerte sind Abmeldefunktionen.
 */

export type Unsubscribe = () => void;

/**
 * Hardware-Zurueck auf Android. Der Rueckgabewert des Handlers entscheidet:
 * `true` = die App hat den Druck behandelt, `false` = die App darf beendet werden.
 */
export function onBackButton(handler: () => boolean): Unsubscribe {
  if (!isNativePlatform()) {
    const onPopState = (): void => {
      if (handler()) {
        // Der Eintrag wird gleich wieder angelegt, damit weiter zurueck moeglich bleibt.
        history.pushState(null, '');
      }
    };
    history.pushState(null, '');
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }

  const listener = App.addListener('backButton', () => {
    if (!handler()) {
      void App.exitApp();
    }
  });

  return () => {
    void listener.then((handle) => handle.remove());
  };
}

/** Wird gerufen, wenn die App in den Hintergrund geht. */
export function onPause(handler: () => void): Unsubscribe {
  if (!isNativePlatform()) {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        handler();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  const listener = App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      handler();
    }
  });
  return () => {
    void listener.then((handle) => handle.remove());
  };
}

/** Wird gerufen, wenn die App wieder in den Vordergrund kommt. */
export function onResume(handler: () => void): Unsubscribe {
  if (!isNativePlatform()) {
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        handler();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  const listener = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      handler();
    }
  });
  return () => {
    void listener.then((handle) => handle.remove());
  };
}
