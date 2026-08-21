import { create } from 'zustand';
import { ADS } from '../config/game.ts';
import {
  initializeAds,
  openPrivacyOptions,
  preloadRewarded,
  removeBanner,
  retryBannerIfMissing,
  showRewardedVideo,
  subscribeAdState,
  type AdServiceState,
  type RewardOutcome,
} from '../services/ads.ts';

export interface AdStore extends AdServiceState {
  /** Laeuft gerade ein Video? Verhindert doppeltes Starten. */
  readonly showingRewarded: boolean;
  start: (adsRemoved: boolean) => void;
  watchRewarded: () => Promise<RewardOutcome>;
  preload: () => void;
  /** Neuer Banner-Versuch bei Rueckkehr in die App. */
  retryBanner: () => void;
  openPrivacySettings: () => Promise<boolean>;
  disableAds: () => Promise<void>;
}

/**
 * Spiegelt den Zustand des AdService in die Oberflaeche und haelt die
 * reservierte Bannerhoehe im Layout aktuell.
 */
export const useAdStore = create<AdStore>((set, get) => ({
  bannerHeightDp: 0,
  rewardedReady: false,
  canRequestAds: false,
  privacyOptionsRequired: false,
  initialized: false,
  showingRewarded: false,

  start: (adsRemoved) => {
    subscribeAdState((next) => {
      set(next);
      applyBannerHeight(next.bannerHeightDp);
    });
    void initializeAds(adsRemoved);
  },

  watchRewarded: async () => {
    if (get().showingRewarded) {
      return 'unavailable';
    }
    set({ showingRewarded: true });
    try {
      return await showRewardedVideo();
    } finally {
      set({ showingRewarded: false });
    }
  },

  preload: () => {
    void preloadRewarded();
  },

  retryBanner: () => {
    retryBannerIfMissing();
  },

  openPrivacySettings: () => openPrivacyOptions(),

  disableAds: async () => {
    await removeBanner();
    applyBannerHeight(0);
  },
}));

/**
 * Schreibt die Bannerhoehe in die CSS-Variablen, die das Wurzel-Layout benutzt.
 *
 * Der Banner ist eine native Ueberlagerung ausserhalb des Webviews. Nur weil das
 * Layout seine Hoehe kennt und fest reserviert, ueberlagert er nie Inhalt — und
 * nichts springt, wenn er spaeter laedt oder wechselt.
 *
 * Zusaetzlich wird ein Abstand von 16 dp zwischen Banner und dem naechsten
 * bedienbaren Element freigehalten, damit niemand versehentlich die Anzeige trifft.
 */
function applyBannerHeight(heightDp: number): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.style.setProperty('--banner-h', `${String(heightDp)}px`);
  root.style.setProperty(
    '--banner-gap',
    heightDp > 0 ? `${String(ADS.minDistanceToInteractiveDp)}px` : '0px',
  );
}
