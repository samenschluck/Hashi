import { useState } from 'react';
import { useAppStore } from '../../state/appStore.ts';
import { LanguageSwitch } from '../components/LanguageSwitch.tsx';
import { RewardDialog } from '../components/RewardDialog.tsx';
import { Button } from '../components/Ui.tsx';

export function MenuScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const navigate = useAppStore((store) => store.navigate);
  const hints = useAppStore((store) => store.save.hints.balance);
  const busy = useAppStore((store) => store.busy);
  const [showRefill, setShowRefill] = useState(false);

  // `overflow-y-auto`: Mit der Sprachzeile wird es auf sehr niedrigen
  // Bildschirmen knapp. Da `justify-between` den oberen Rand stehen laesst,
  // ist der Inhalt dann schiebbar statt abgeschnitten.
  return (
    <div className="screen-column flex h-full flex-col justify-between gap-6 overflow-y-auto px-6 py-8">
      <div className="mt-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{t('app.name')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('app.tagline')}</p>
        {/* Direkt unter dem Titel, nicht in den Einstellungen versteckt: Wer die
            App in einer fremden Sprache vorfindet, sieht die Flaggen sofort. */}
        <div className="mt-4 flex justify-center">
          <LanguageSwitch />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          full
          onClick={() => {
            navigate('levels');
          }}
        >
          {t('menu.play')}
        </Button>
        <Button
          full
          disabled={busy}
          onClick={() => {
            navigate('daily');
          }}
        >
          {t('menu.daily')}
        </Button>
        <Button
          full
          onClick={() => {
            navigate('stats');
          }}
        >
          {t('menu.stats')}
        </Button>
        <Button
          full
          onClick={() => {
            navigate('rules');
          }}
        >
          {t('menu.rules')}
        </Button>
        <Button
          full
          onClick={() => {
            navigate('settings');
          }}
        >
          {t('menu.settings')}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-slate-400">{t('game.hintsLeft', { count: hints })}</p>
        <Button
          variant="ghost"
          onClick={() => {
            setShowRefill(true);
          }}
        >
          {t('menu.refillHints')}
        </Button>
      </div>

      {showRefill ? (
        <RewardDialog
          onClose={() => {
            setShowRefill(false);
          }}
        />
      ) : null}
    </div>
  );
}
