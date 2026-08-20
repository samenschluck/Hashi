import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAdConfig, TEST_BANNER_ID, TEST_REWARDED_ID } from './adConfig.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Werbe-Konfiguration', () => {
  it('benutzt ohne gesetzte IDs die Test-IDs und bleibt im Testmodus', () => {
    const config = readAdConfig();
    expect(config.bannerId).toBe(TEST_BANNER_ID);
    expect(config.rewardedId).toBe(TEST_REWARDED_ID);
    expect(config.isTesting).toBe(true);
  });

  it('bleibt auch dann im Testmodus, wenn nur der Schalter auf false steht', () => {
    // Ohne echte IDs waere „keine Testanzeigen" ein Widerspruch — und ein Klick
    // auf eine echte Anzeige im eigenen Geraet kann das AdMob-Konto kosten.
    vi.stubEnv('VITE_ADMOB_TESTING', 'false');
    expect(readAdConfig().isTesting).toBe(true);
  });

  it('uebernimmt echte IDs und schaltet den Testmodus erst dann ab', () => {
    vi.stubEnv('VITE_ADMOB_BANNER_ID', 'ca-app-pub-1111111111111111/2222222222');
    vi.stubEnv('VITE_ADMOB_REWARDED_ID', 'ca-app-pub-1111111111111111/3333333333');
    vi.stubEnv('VITE_ADMOB_TESTING', 'false');

    const config = readAdConfig();
    expect(config.bannerId).toBe('ca-app-pub-1111111111111111/2222222222');
    expect(config.rewardedId).toBe('ca-app-pub-1111111111111111/3333333333');
    expect(config.isTesting).toBe(false);
  });

  it('behaelt die Test-ID fuer die Sorte, die nicht gesetzt wurde', () => {
    vi.stubEnv('VITE_ADMOB_BANNER_ID', 'ca-app-pub-1111111111111111/2222222222');
    const config = readAdConfig();
    expect(config.rewardedId).toBe(TEST_REWARDED_ID);
  });

  it('liest Testgeraete als Liste und ignoriert Leerraum', () => {
    vi.stubEnv('VITE_ADMOB_TEST_DEVICES', ' ABC123 , DEF456 ,, ');
    expect(readAdConfig().testDevices).toEqual(['ABC123', 'DEF456']);
  });

  it('nimmt nur bekannte Werte fuer die Testregion an', () => {
    vi.stubEnv('VITE_ADMOB_DEBUG_GEOGRAPHY', 'EEA');
    expect(readAdConfig().debugGeography).toBe('EEA');

    vi.stubEnv('VITE_ADMOB_DEBUG_GEOGRAPHY', 'OTHER');
    expect(readAdConfig().debugGeography).toBe('OTHER');

    vi.stubEnv('VITE_ADMOB_DEBUG_GEOGRAPHY', 'unsinn');
    expect(readAdConfig().debugGeography).toBe('DISABLED');
  });
});
