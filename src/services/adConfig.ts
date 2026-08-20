/**
 * Werbe-IDs und Testschalter.
 *
 * **Die Test-IDs sind hier fest verdrahtet und werden benutzt, solange keine
 * echten IDs gesetzt sind.** Ein Klick auf eine echte Anzeige im eigenen
 * Testgeraet gilt als ungueltiger Traffic und kann das AdMob-Konto sperren —
 * deshalb ist die sichere Variante der Standard, nicht die Ausnahme.
 *
 * Herkunft der Werte (nachgeschlagen, nicht aus dem Gedaechtnis):
 * - App-ID aus dem offiziellen Beispielprojekt von Google
 *   (googleads-mobile-android-examples, BannerExample/AndroidManifest.xml).
 * - Banner- und Rewarded-Unit-ID aus dem Plugin selbst, das sie als
 *   `BANNER_TESTER_ID` und `REWARD_VIDEO_TESTER_ID` mitliefert
 *   (@capacitor-community/admob, android/.../models/AdOptions.java).
 */

/** Googles Test-App-ID. Wird nur ueber `scripts/inject-admob-appid.ts` gebraucht. */
export const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

/** Googles Test-Unit-ID fuer Banner. */
export const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

/** Googles Test-Unit-ID fuer belohnte Videos. */
export const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

function readEnv(name: string): string | undefined {
  const env = import.meta.env as Readonly<Record<string, string | undefined>>;
  const value = env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

export interface AdConfig {
  readonly bannerId: string;
  readonly rewardedId: string;
  /** Testanzeigen anfordern? Bleibt true, solange keine echten IDs gesetzt sind. */
  readonly isTesting: boolean;
  readonly testDevices: readonly string[];
  /**
   * Erzwingt im Debug-Build eine Region zum Testen des Einwilligungsformulars.
   * `OTHER` steht fuer „ausserhalb der EEA"; der frueher dafuer benutzte Wert
   * `NOT_EEA` ist im Plugin als veraltet gekennzeichnet.
   */
  readonly debugGeography: 'EEA' | 'OTHER' | 'DISABLED';
}

export function readAdConfig(): AdConfig {
  const bannerId = readEnv('VITE_ADMOB_BANNER_ID');
  const rewardedId = readEnv('VITE_ADMOB_REWARDED_ID');
  const usingRealIds = bannerId !== undefined || rewardedId !== undefined;

  const geography = readEnv('VITE_ADMOB_DEBUG_GEOGRAPHY');

  return {
    bannerId: bannerId ?? TEST_BANNER_ID,
    rewardedId: rewardedId ?? TEST_REWARDED_ID,
    // Ohne echte IDs immer Testmodus. Mit echten IDs nur, wenn ausdruecklich gewuenscht.
    isTesting: usingRealIds ? readEnv('VITE_ADMOB_TESTING') === 'true' : true,
    testDevices:
      readEnv('VITE_ADMOB_TEST_DEVICES')
        ?.split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) ?? [],
    debugGeography: geography === 'EEA' || geography === 'OTHER' ? geography : 'DISABLED',
  };
}
