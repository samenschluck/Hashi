import { useEffect } from 'react';
import { onBackButton, onPause, onResume } from '../services/appLifecycle.ts';
import { isNativePlatform } from '../services/platform.ts';
import { useAdStore } from '../state/adStore.ts';
import { useAppStore, type Screen } from '../state/appStore.ts';
import { Notice } from './components/Ui.tsx';
import { DailyScreen } from './screens/DailyScreen.tsx';
import { GameScreen } from './screens/GameScreen.tsx';
import { LevelSelectScreen } from './screens/LevelSelectScreen.tsx';
import { MenuScreen } from './screens/MenuScreen.tsx';
import { ResultScreen } from './screens/ResultScreen.tsx';
import { RulesScreen } from './screens/RulesScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { StatsScreen } from './screens/StatsScreen.tsx';

/** Wie lange eine kurze Rueckmeldung stehen bleibt. */
const NOTICE_DURATION_MS = 2600;

export function App(): React.JSX.Element {
  const ready = useAppStore((store) => store.ready);
  const screen = useAppStore((store) => store.screen);
  const notice = useAppStore((store) => store.notice);
  const bannerHeightDp = useAdStore((store) => store.bannerHeightDp);

  useEffect(() => {
    void useAppStore
      .getState()
      .init()
      .then(() => {
        // Werbung startet erst, wenn der Spielstand geladen ist: das Kennzeichen
        // `adsRemoved` entscheidet, ob ueberhaupt ein Banner angefragt wird.
        useAdStore.getState().start(useAppStore.getState().save.ads.adsRemoved);
      });
  }, []);

  // Android-Zurueck auf jedem Bildschirm: im Menue beendet es die App, sonst
  // fuehrt es eine Ebene zurueck.
  useEffect(() => onBackButton(() => useAppStore.getState().back()), []);

  // Pause und Fortsetzen: die Uhr haelt an, der Zwischenstand wird sofort
  // geschrieben. Ein von Android beendeter Prozess verliert damit nichts.
  useEffect(
    () =>
      onPause(() => {
        useAppStore.getState().pauseTimer();
      }),
    [],
  );
  useEffect(
    () =>
      onResume(() => {
        useAppStore.getState().resumeTimer();
        // Steht gerade kein Banner, ist die Rueckkehr in die App ein guter
        // Moment fuer einen neuen Versuch — oft hat sich das Netz geaendert.
        useAdStore.getState().retryBanner();
      }),
    [],
  );

  useEffect(() => {
    if (notice === null) {
      return;
    }
    const timer = setTimeout(() => {
      useAppStore.getState().setNotice(null);
    }, NOTICE_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);

  return (
    <div className="app-shell">
      <main className="app-content">
        {notice ? <Notice message={notice} /> : null}
        {ready ? renderScreen(screen) : <SplashScreen />}
      </main>
      {/* Fest reservierte Flaeche fuer den Anchored Banner. Nativ liegt der
          Banner als Ueberlagerung darueber, im Browser steht hier ein
          Platzhalter derselben Hoehe. */}
      <div className="app-banner-slot">
        {!isNativePlatform() && bannerHeightDp > 0 ? (
          <div className="app-banner-placeholder">Werbung</div>
        ) : null}
      </div>
    </div>
  );
}

function renderScreen(screen: Screen): React.JSX.Element {
  switch (screen) {
    case 'levels':
      return <LevelSelectScreen />;
    case 'game':
      return <GameScreen />;
    case 'result':
      return <ResultScreen />;
    case 'daily':
      return <DailyScreen />;
    case 'stats':
      return <StatsScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'rules':
      return <RulesScreen />;
    case 'splash':
    case 'menu':
      return screen === 'menu' ? <MenuScreen /> : <SplashScreen />;
  }
}

function SplashScreen(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">Bridgelet</h1>
      <p className="text-sm text-slate-400">Brücken-Logikrätsel</p>
    </div>
  );
}
