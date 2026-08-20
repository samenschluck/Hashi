import { DIFFICULTIES } from '../../config/game.ts';
import { averageSolveTime } from '../../core/progression.ts';
import { useAppStore } from '../../state/appStore.ts';
import { ScreenFrame } from '../components/Ui.tsx';
import { formatDuration } from '../format.ts';

export function StatsScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const back = useAppStore((store) => store.back);
  const save = useAppStore((store) => store.save);

  const average = averageSolveTime(save);

  return (
    <ScreenFrame title={t('stats.title')} onBack={back} backLabel={t('common.back')}>
      {save.stats.solvedTotal === 0 ? (
        <p className="text-sm text-slate-400">{t('stats.none')}</p>
      ) : null}

      <dl className="divide-y divide-slate-800">
        <Row label={t('stats.solved')} value={String(save.stats.solvedTotal)} />
        <Row
          label={t('stats.averageTime')}
          value={average === null ? '—' : formatDuration(average)}
        />
        <Row label={t('stats.longestStreak')} value={String(save.daily.longestStreak)} />
        <Row label={t('stats.hintsSpent')} value={String(save.stats.hintsSpent)} />
      </dl>

      <h3 className="mt-6 mb-2 text-sm font-medium text-slate-300">{t('levels.title')}</h3>
      <dl className="divide-y divide-slate-800">
        {DIFFICULTIES.map((difficulty) => (
          <Row
            key={difficulty}
            label={t(`difficulty.${difficulty}`)}
            value={String(save.stats.solvedByDifficulty[difficulty])}
          />
        ))}
      </dl>
    </ScreenFrame>
  );
}

function Row({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-center justify-between py-2">
      <dt className="text-sm text-slate-300">{label}</dt>
      <dd className="text-sm font-medium text-slate-100">{value}</dd>
    </div>
  );
}
