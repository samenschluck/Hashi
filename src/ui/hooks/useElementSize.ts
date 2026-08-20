import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Misst die tatsaechliche Groesse eines Elements.
 *
 * Wichtig fuer das Spielfeld: die Boardflaeche wird gegen die verbleibende Hoehe
 * berechnet, nicht gegen die Viewport-Hoehe. Kopfleiste, reservierte Bannerhoehe
 * und Safe-Area sind damit automatisch beruecksichtigt, weil sie das Element
 * bereits verkleinert haben.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const box = entry.contentRect;
      setSize((previous) =>
        previous.width === box.width && previous.height === box.height
          ? previous
          : { width: box.width, height: box.height },
      );
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
