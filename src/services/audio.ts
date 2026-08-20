/**
 * Klangeffekte.
 *
 * Bewusst ohne Audiodateien: die vier Toene werden mit der Web Audio API
 * erzeugt. Das spart Ladezeit und Paketgroesse, klingt bei kurzen
 * Rueckmeldungen genauso gut und kann nicht an einem fehlenden Asset scheitern.
 *
 * Zwei Dinge sind hier wichtig:
 * - Browser und WebView erlauben Audio erst nach einer Nutzergeste. Der
 *   AudioContext wird deshalb erst beim ersten Ton angelegt und, falls
 *   angehalten, wieder fortgesetzt.
 * - Kein Aufruf darf jemals werfen. Ton ist Beiwerk und darf keinen Zug kosten.
 */

let enabled = true;
let context: AudioContext | null = null;

/** Aus den Einstellungen gesteuert. */
export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function soundEnabled(): boolean {
  return enabled;
}

function audioContext(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') {
    return null;
  }
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') {
      void context.resume();
    }
    return context;
  } catch {
    return null;
  }
}

interface ToneOptions {
  readonly frequency: number;
  readonly durationMs: number;
  /** Lautstaerke zwischen 0 und 1. Absichtlich leise — das Spiel ist ruhig. */
  readonly volume: number;
  readonly type?: OscillatorType;
  /** Verzoegerung in ms, um mehrere Toene zu einer kleinen Folge zu reihen. */
  readonly delayMs?: number;
}

function tone({ frequency, durationMs, volume, type = 'sine', delayMs = 0 }: ToneOptions): void {
  const ctx = audioContext();
  if (!ctx) {
    return;
  }

  try {
    const start = ctx.currentTime + delayMs / 1000;
    const end = start + durationMs / 1000;

    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);

    // Weiche Huellkurve: ein harter Ein- und Ausschaltvorgang knackt hoerbar.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  } catch {
    // Kein Audio verfuegbar — dann eben still.
  }
}

/** Bruecke gesetzt oder veraendert. */
export function soundBridgePlaced(): void {
  tone({ frequency: 520, durationMs: 70, volume: 0.06 });
}

/** Insel vollstaendig belegt. */
export function soundIslandSatisfied(): void {
  tone({ frequency: 660, durationMs: 90, volume: 0.07 });
  tone({ frequency: 880, durationMs: 110, volume: 0.05, delayMs: 60 });
}

/** Unzulaessiger Zug, etwa eine kreuzende Bruecke. */
export function soundRejected(): void {
  tone({ frequency: 180, durationMs: 110, volume: 0.05, type: 'triangle' });
}

/** Raetsel geloest. */
export function soundSolved(): void {
  tone({ frequency: 523.25, durationMs: 140, volume: 0.07 });
  tone({ frequency: 659.25, durationMs: 140, volume: 0.07, delayMs: 110 });
  tone({ frequency: 783.99, durationMs: 260, volume: 0.08, delayMs: 220 });
}
