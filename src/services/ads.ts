import {
  AdMob,
  AdmobConsentDebugGeography,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  RewardAdPluginEvents,
  type AdMobError,
  type AdMobBannerSize,
} from '@capacitor-community/admob';
import { ADS } from '../config/game.ts';
import { readAdConfig } from './adConfig.ts';
import { isNativePlatform } from './platform.ts';

/**
 * Einziger Beruehrungspunkt zur AdMob-SDK.
 *
 * Zwei Grundsaetze bestimmen den Aufbau:
 *
 * 1. **Das Spiel funktioniert vollstaendig ohne Werbung.** Kein Ad-Aufruf darf
 *    einen Fehler nach oben durchreichen, kein Pfad darf auf ein geladenes Video
 *    warten. Faellt alles aus, fehlt nur die Werbung.
 * 2. **Der Banner darf nie Inhalt ueberlagern.** Er ist eine native Ueberlagerung
 *    ausserhalb des Webviews; das Layout muss seine Hoehe kennen und
 *    reservieren. Deshalb wird jede gemeldete Groessenaenderung sofort nach oben
 *    weitergegeben.
 */

export interface AdServiceState {
  /** Hoehe des sichtbaren Banners in dp. 0 = kein Banner. */
  readonly bannerHeightDp: number;
  readonly rewardedReady: boolean;
  /** Darf ueberhaupt Werbung angefragt werden (Consent erteilt oder nicht noetig)? */
  readonly canRequestAds: boolean;
  /** Muss der Menuepunkt „Datenschutzeinstellungen" angeboten werden? */
  readonly privacyOptionsRequired: boolean;
  readonly initialized: boolean;
}

export type RewardOutcome = 'rewarded' | 'dismissed' | 'unavailable';

const INITIAL_STATE: AdServiceState = {
  bannerHeightDp: 0,
  rewardedReady: false,
  canRequestAds: false,
  privacyOptionsRequired: false,
  initialized: false,
};

let state: AdServiceState = INITIAL_STATE;
let listener: ((next: AdServiceState) => void) | null = null;
let bannerVisible = false;
/** Wird auf true gesetzt, sobald die Einwilligung erteilt wurde. */
let personalizedAllowed = false;

export function getAdState(): AdServiceState {
  return state;
}

export function subscribeAdState(next: (value: AdServiceState) => void): () => void {
  listener = next;
  next(state);
  return () => {
    listener = null;
  };
}

/** Siehe Kommentar an der Aufrufstelle: der Enum-Typ ist nicht exportiert. */
function isPrivacyOptionsRequired(status: { toString: () => string }): boolean {
  return status.toString() === 'REQUIRED';
}

function update(change: Partial<AdServiceState>): void {
  state = { ...state, ...change };
  listener?.(state);
}

/**
 * Startet den Werbeteil.
 *
 * Reihenfolge ist Pflicht: erst der Einwilligungsdialog (UMP), dann die
 * Initialisierung der SDK, dann die erste Anzeige. Ohne Einwilligung wird gar
 * nichts angefragt — das ist die DSGVO-Anforderung und zugleich AdMob-Richtlinie.
 */
export async function initializeAds(adsRemoved: boolean): Promise<void> {
  if (!isNativePlatform()) {
    initializeWebMock(adsRemoved);
    return;
  }

  const config = readAdConfig();

  try {
    const consent = await AdMob.requestConsentInfo({
      tagForUnderAgeOfConsent: false,
      ...(config.testDevices.length > 0 ? { testDeviceIdentifiers: [...config.testDevices] } : {}),
      ...(config.debugGeography === 'DISABLED'
        ? {}
        : {
            debugGeography:
              config.debugGeography === 'EEA'
                ? AdmobConsentDebugGeography.EEA
                : AdmobConsentDebugGeography.OTHER,
          }),
    });

    let status = consent.status;
    let canRequestAds = consent.canRequestAds;
    // Das Plugin exportiert `PrivacyOptionsRequirementStatus` in Version 8.1.0
    // nicht aus seinem Einstiegspunkt, obwohl der Typ im Ergebnis vorkommt.
    // Deshalb wird hier gegen den Zeichenkettenwert verglichen.
    let privacyRequired = isPrivacyOptionsRequired(consent.privacyOptionsRequirementStatus);

    if (status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable === true) {
      const afterForm = await AdMob.showConsentForm();
      status = afterForm.status;
      canRequestAds = afterForm.canRequestAds;
      privacyRequired = isPrivacyOptionsRequired(afterForm.privacyOptionsRequirementStatus);
    }

    // Nur mit ausdruecklicher Einwilligung personalisierte Anzeigen.
    personalizedAllowed = status === AdmobConsentStatus.OBTAINED;

    await AdMob.initialize({
      initializeForTesting: config.isTesting,
      testingDevices: [...config.testDevices],
      // Die App richtet sich nicht vorrangig an Kinder.
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    registerBannerEvents();
    registerRewardedEvents();

    update({ initialized: true, canRequestAds, privacyOptionsRequired: privacyRequired });

    if (!canRequestAds) {
      return;
    }
    if (!adsRemoved) {
      await showBanner();
    }
    await preloadRewarded();
  } catch {
    // Kein Netz, kein Consent-Formular, SDK-Fehler — das Spiel laeuft trotzdem.
    update({ initialized: true, canRequestAds: false });
  }
}

/**
 * Im Browser gibt es keine echte Werbung. Der Platzhalter meldet trotzdem eine
 * Hoehe, damit sich das Layout mit reserviertem Banner im Browser pruefen laesst.
 */
function initializeWebMock(adsRemoved: boolean): void {
  update({
    initialized: true,
    canRequestAds: true,
    privacyOptionsRequired: false,
    bannerHeightDp: adsRemoved ? 0 : ADS.estimatedBannerHeightDp,
    rewardedReady: true,
  });
  bannerVisible = !adsRemoved;
}

function registerBannerEvents(): void {
  // Die einzige verlaessliche Quelle fuer die echte Bannerhoehe.
  void AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
    update({ bannerHeightDp: size.height });
  });
  void AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (_error: AdMobError) => {
    // Ohne Banner bekommt das Brett den Platz zurueck.
    update({ bannerHeightDp: 0 });
  });
}

function registerRewardedEvents(): void {
  void AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
    update({ rewardedReady: true });
  });
  void AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (_error: AdMobError) => {
    update({ rewardedReady: false });
  });
  void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
    // Nach jedem Video sofort das naechste vorladen.
    update({ rewardedReady: false });
    void preloadRewarded();
  });
}

/** Zeigt den adaptiven Banner am unteren Rand. */
export async function showBanner(): Promise<void> {
  if (!isNativePlatform() || bannerVisible) {
    return;
  }
  const config = readAdConfig();
  try {
    await AdMob.showBanner({
      adId: config.bannerId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: config.isTesting,
      npa: !personalizedAllowed,
    });
    bannerVisible = true;
  } catch {
    update({ bannerHeightDp: 0 });
  }
}

/** Entfernt den Banner, etwa wenn „Werbung entfernen" gekauft wurde. */
export async function removeBanner(): Promise<void> {
  update({ bannerHeightDp: 0 });
  if (!isNativePlatform()) {
    bannerVisible = false;
    return;
  }
  try {
    await AdMob.removeBanner();
  } catch {
    // Nichts zu tun — der reservierte Platz ist bereits freigegeben.
  }
  bannerVisible = false;
}

/** Laedt ein belohntes Video vor. Wird beim Levelstart und nach jedem Video gerufen. */
export async function preloadRewarded(): Promise<void> {
  if (!isNativePlatform()) {
    update({ rewardedReady: true });
    return;
  }
  if (!state.canRequestAds) {
    return;
  }
  const config = readAdConfig();
  try {
    await AdMob.prepareRewardVideoAd({
      adId: config.rewardedId,
      isTesting: config.isTesting,
      npa: !personalizedAllowed,
    });
    update({ rewardedReady: true });
  } catch {
    update({ rewardedReady: false });
  }
}

/**
 * Zeigt ein belohntes Video.
 *
 * Liefert `rewarded` nur, wenn das Video **vollstaendig** angesehen wurde.
 * Bricht der Spieler ab, kommt `dismissed` — ohne Gutschrift, aber auch ohne
 * Strafe. Ist nichts geladen, kommt `unavailable`; der Aufrufer zeigt dann eine
 * klare Meldung statt eines Endlos-Spinners.
 */
export async function showRewardedVideo(): Promise<RewardOutcome> {
  if (!isNativePlatform()) {
    // Im Browser wird ein vollstaendig angesehenes Video simuliert.
    update({ rewardedReady: false });
    await new Promise((resolve) => setTimeout(resolve, 400));
    update({ rewardedReady: true });
    return 'rewarded';
  }

  if (!state.rewardedReady) {
    void preloadRewarded();
    return 'unavailable';
  }

  try {
    const reward = await AdMob.showRewardVideoAd();
    update({ rewardedReady: false });
    void preloadRewarded();
    // Das Versprechen loest nur auf, wenn die Belohnung verdient wurde.
    return reward.amount > 0 || reward.type.length > 0 ? 'rewarded' : 'dismissed';
  } catch {
    update({ rewardedReady: false });
    void preloadRewarded();
    return 'dismissed';
  }
}

/** Oeffnet das Datenschutzformular erneut (Menuepunkt in den Einstellungen). */
export async function openPrivacyOptions(): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }
  try {
    await AdMob.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}
