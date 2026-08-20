import { useAppStore } from '../../state/appStore.ts';
import { ScreenFrame } from '../components/Ui.tsx';

export function RulesScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const back = useAppStore((store) => store.back);

  return (
    <ScreenFrame title={t('rules.title')} onBack={back} backLabel={t('common.back')}>
      <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">
        {t('rules.body')}
      </p>
    </ScreenFrame>
  );
}
