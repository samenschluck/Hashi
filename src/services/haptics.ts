import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativePlatform } from './platform.ts';

/**
 * Haptisches Feedback mit Web-Fallback.
 *
 * Nativ laeuft alles ueber @capacitor/haptics. Im Browser wird, falls vorhanden,
 * `navigator.vibrate` benutzt; wo auch das fehlt, passiert schlicht nichts.
 * Kein Aufruf darf jemals einen Fehler nach oben durchreichen — Vibration ist
 * Beiwerk und darf niemals einen Spielzug scheitern lassen.
 */

let enabled = true;

/** Aus den Einstellungen gesteuert (Meilenstein 3). */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

function vibrateFallback(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

async function run(native: () => Promise<void>, fallbackPattern: number | number[]): Promise<void> {
  if (!enabled) {
    return;
  }
  try {
    if (isNativePlatform()) {
      await native();
    } else {
      vibrateFallback(fallbackPattern);
    }
  } catch {
    // Absichtlich verschluckt: fehlende Hardware oder verweigerte Berechtigung
    // duerfen den Spielfluss nicht stoeren.
  }
}

/** Kurzer Impuls beim Setzen oder Aendern einer Bruecke. */
export function hapticBridgePlaced(): void {
  void run(() => Haptics.impact({ style: ImpactStyle.Light }), 12);
}

/** Etwas kraeftiger, wenn eine Insel vollstaendig belegt ist. */
export function hapticIslandSatisfied(): void {
  void run(() => Haptics.impact({ style: ImpactStyle.Medium }), 20);
}

/** Rueckmeldung auf einen unzulaessigen Zug, etwa eine kreuzende Bruecke. */
export function hapticRejected(): void {
  void run(() => Haptics.notification({ type: NotificationType.Warning }), [10, 40, 10]);
}

/** Abschlussfeedback beim geloesten Raetsel. */
export function hapticSolved(): void {
  void run(() => Haptics.notification({ type: NotificationType.Success }), [15, 60, 25]);
}
