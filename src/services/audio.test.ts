import { afterEach, describe, expect, it } from 'vitest';
import {
  setSoundEnabled,
  soundBridgePlaced,
  soundEnabled,
  soundIslandSatisfied,
  soundRejected,
  soundSolved,
} from './audio.ts';

afterEach(() => {
  setSoundEnabled(true);
});

describe('Klangeffekte', () => {
  it('merkt sich die Einstellung', () => {
    setSoundEnabled(false);
    expect(soundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(soundEnabled()).toBe(true);
  });

  it('wirft nie — auch nicht ohne Audio-Unterstuetzung', () => {
    // In der Testumgebung gibt es keinen AudioContext. Genau dieser Fall muss
    // still bleiben: ein fehlender Ton darf niemals einen Spielzug kosten.
    for (const play of [soundBridgePlaced, soundIslandSatisfied, soundRejected, soundSolved]) {
      expect(() => {
        play();
      }).not.toThrow();
    }
  });

  it('bleibt auch bei abgeschaltetem Ton fehlerfrei', () => {
    setSoundEnabled(false);
    expect(() => {
      soundSolved();
    }).not.toThrow();
  });
});
