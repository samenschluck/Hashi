import { STARS } from '../../config/game.ts';
import type { TranslationKey } from '../../i18n/index.ts';
import { useAppStore } from '../../state/appStore.ts';
import { Button, Stars } from '../components/Ui.tsx';
import { formatDuration } from '../format.ts';

/**
 * Begruendung zur Sternezahl. Als feste Zuordnung statt zusammengesetztem
 * Schluessel, damit fehlende Uebersetzungen beim Typcheck auffallen.
 */
const STAR_MESSAGES: Readonly<Record<number, TranslationKey>> = {
  1: 'result.stars1',
  2: 'result.stars2',
  3: 'result.stars3',
};

export function ResultScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const result = useAppStore((store) => store.result);
  const active = useAppStore((store) => store.active);
  const levels = useAppStore((store) => store.save.levels);
  const busy = useAppStore((store) => store.busy);

  const best = active ? levels[active.levelId]?.bestTimeMs : null;

  return (
    <div className="screen-column flex h-full flex-col justify-between px-6 py-8 text-center">
      <div className="mt-10">
        <p className="text-5xl">🎉</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">{t('result.title')}</h2>
        {result ? (
          <div className="mt-6 space-y-1 text-sm text-slate-300">
            <p className="mb-3">
              <Stars
                earned={result.stars}
                size="text-4xl"
                label={t('result.starsLabel', { count: result.stars, max: STARS.max })}
              />
            </p>
            <p className="text-slate-400">{t(STAR_MESSAGES[result.stars] ?? 'result.stars1')}</p>
            {result.isNewBestStars ? (
              <p className="text-amber-400">{t('result.newBestStars')}</p>
            ) : null}
            <p>
              {t('result.time')}: <strong>{formatDuration(result.timeMs)}</strong>
            </p>
            {best !== null && best !== undefined ? (
              <p>
                {t('result.bestTime')}: <strong>{formatDuration(best)}</strong>
              </p>
            ) : null}
            {result.isNewBest ? <p className="text-emerald-400">{t('result.newBest')}</p> : null}
            {result.hintsUsed > 0 ? (
              <p>{t('result.hintsUsed', { count: result.hintsUsed })}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          full
          disabled={busy}
          onClick={() => {
            void useAppStore.getState().startNextLevel();
          }}
        >
          {t('result.next')}
        </Button>
        <Button
          full
          disabled={busy}
          onClick={() => {
            useAppStore.getState().replayLevel();
          }}
        >
          {t('result.replay')}
        </Button>
        <Button
          variant="ghost"
          full
          onClick={() => {
            useAppStore.getState().back();
          }}
        >
          {t('result.toLevels')}
        </Button>
      </div>
    </div>
  );
}
