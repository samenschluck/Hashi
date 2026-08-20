import { useState } from 'react';
import { dayKey, currentStreak, effectiveNow } from '../../core/progression.ts';
import { useAppStore } from '../../state/appStore.ts';
import { Button, ScreenFrame } from '../components/Ui.tsx';
import { formatDay } from '../format.ts';

/**
 * Tagesraetsel mit Kalenderansicht des laufenden Monats.
 * Der Seed haengt nur am Datum — jeder Spieler bekommt dasselbe Raetsel.
 */
export function DailyScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const back = useAppStore((store) => store.back);
  const save = useAppStore((store) => store.save);
  const busy = useAppStore((store) => store.busy);
  const locale = save.settings.locale;

  // Der Zeitpunkt wird einmal beim Aufbau des Bildschirms festgehalten. Waehrend
  // des Renderns die Uhr zu lesen waere unrein und koennte bei einem
  // Neuzeichnen ploetzlich einen anderen Tag anzeigen.
  const [now] = useState(() => Date.now());
  const today = dayKey(effectiveNow(save, now));
  const solvedToday = save.daily.solvedDays.includes(today);
  const streak = currentStreak(save, now);

  const days = monthDays(today);

  return (
    <ScreenFrame title={t('daily.title')} onBack={back} backLabel={t('common.back')}>
      <p className="text-sm text-slate-300">{formatDay(today, locale)}</p>
      <p className="mt-1 text-xs text-slate-400">{t('daily.streak', { count: streak })}</p>
      <p className="text-xs text-slate-400">
        {t('daily.longestStreak', { count: save.daily.longestStreak })}
      </p>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const solved = save.daily.solvedDays.includes(day.key);
          return (
            <div
              key={day.key}
              className={`flex aspect-square items-center justify-center rounded-lg text-xs ${
                day.key === today ? 'ring-2 ring-sky-400' : ''
              } ${solved ? 'bg-emerald-700/70 text-emerald-50' : 'bg-slate-800 text-slate-400'}`}
            >
              {day.number}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Button
          variant="primary"
          full
          disabled={busy}
          onClick={() => {
            void useAppStore.getState().startDaily();
          }}
        >
          {solvedToday ? t('result.replay') : t('daily.play')}
        </Button>
        {solvedToday ? (
          <p className="mt-2 text-center text-xs text-emerald-400">{t('daily.solvedToday')}</p>
        ) : null}
      </div>
    </ScreenFrame>
  );
}

/** Alle Tage des Monats, zu dem der uebergebene Tag gehoert. */
function monthDays(day: string): { key: string; number: number }[] {
  const [year, month] = day.split('-').map((part) => Number.parseInt(part, 10));
  const safeYear = year ?? 1970;
  const safeMonth = month ?? 1;
  const count = new Date(safeYear, safeMonth, 0).getDate();

  return Array.from({ length: count }, (_, index) => ({
    key: `${String(safeYear)}-${String(safeMonth).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
    number: index + 1,
  }));
}
