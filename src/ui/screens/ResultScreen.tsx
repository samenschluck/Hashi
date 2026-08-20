import { useAppStore } from '../../state/appStore.ts';
import { Button } from '../components/Ui.tsx';
import { formatDuration } from '../format.ts';

export function ResultScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const result = useAppStore((store) => store.result);
  const active = useAppStore((store) => store.active);
  const levels = useAppStore((store) => store.save.levels);
  const busy = useAppStore((store) => store.busy);

  const best = active ? levels[active.levelId]?.bestTimeMs : null;

  return (
    <div className="flex h-full flex-col justify-between px-6 py-8 text-center">
      <div className="mt-10">
        <p className="text-5xl">🎉</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">{t('result.title')}</h2>
        {result ? (
          <div className="mt-6 space-y-1 text-sm text-slate-300">
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
