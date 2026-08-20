import { useState } from 'react';
import { ADS, HINTS } from '../../config/game.ts';
import { remainingRewardedToday } from '../../core/progression.ts';
import { useAdStore } from '../../state/adStore.ts';
import { useAppStore } from '../../state/appStore.ts';
import { Button, Dialog } from './Ui.tsx';

export interface RewardDialogProps {
  readonly onClose: () => void;
}

/**
 * „Keine Tipps mehr — Video ansehen?"
 *
 * Die einzige Belohnung im Spiel sind Tipps, und sie gibt es erst nach einem
 * **vollstaendig** angesehenen Video. Ein Abbruch kostet nichts und bringt nichts.
 *
 * Drei Faelle fuehren dazu, dass der Knopf gesperrt ist — und in allen dreien
 * steht eine klare Meldung statt eines Endlos-Spinners:
 * kein Video geladen, Tageslimit erreicht, oder gerade laeuft schon eines.
 */
export function RewardDialog({ onClose }: RewardDialogProps): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const save = useAppStore((store) => store.save);
  const rewardedReady = useAdStore((store) => store.rewardedReady);
  const showing = useAdStore((store) => store.showingRewarded);

  const [message, setMessage] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const remaining = remainingRewardedToday(save, now);
  const limitReached = remaining <= 0;
  const disabled = showing || limitReached || !rewardedReady;

  const watch = (): void => {
    void (async () => {
      const outcome = await useAdStore.getState().watchRewarded();
      if (outcome === 'rewarded') {
        useAppStore.getState().grantRewardHints();
        onClose();
        return;
      }
      if (outcome === 'unavailable') {
        setMessage(t('hints.unavailable'));
        useAdStore.getState().preload();
        return;
      }
      // Abgebrochen: keine Gutschrift, aber auch keine Strafe.
      onClose();
    })();
  };

  return (
    <Dialog
      title={t('hints.title')}
      onDismiss={onClose}
      actions={
        <>
          <Button variant="primary" full disabled={disabled} onClick={watch}>
            {t('hints.watch')}
          </Button>
          <Button variant="ghost" full onClick={onClose}>
            {t('hints.later')}
          </Button>
        </>
      }
    >
      <p>{t('hints.offer', { count: HINTS.rewardedGrant })}</p>
      {limitReached ? <p className="mt-2 text-amber-300">{t('hints.dailyLimit')}</p> : null}
      {!limitReached && !rewardedReady ? (
        <p className="mt-2 text-amber-300">{t('hints.unavailable')}</p>
      ) : null}
      {message ? <p className="mt-2 text-amber-300">{message}</p> : null}
      {!limitReached ? (
        <p className="mt-2 text-xs text-slate-500">
          {String(remaining)} / {String(ADS.maxRewardedPerDay)}
        </p>
      ) : null}
    </Dialog>
  );
}
