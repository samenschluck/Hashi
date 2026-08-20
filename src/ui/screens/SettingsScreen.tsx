import { useState } from 'react';
import type { Locale, ThemePreference } from '../../core/progression.ts';
import { useAppStore } from '../../state/appStore.ts';
import { Button, Dialog, ScreenFrame, Select, Toggle } from '../components/Ui.tsx';

export function SettingsScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const back = useAppStore((store) => store.back);
  const settings = useAppStore((store) => store.save.settings);
  const update = useAppStore((store) => store.updateSettings);

  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <ScreenFrame title={t('settings.title')} onBack={back} backLabel={t('common.back')}>
      <div className="divide-y divide-slate-800">
        <Toggle
          label={t('settings.sound')}
          checked={settings.sound}
          onChange={(value) => {
            update({ sound: value });
          }}
        />
        <Toggle
          label={t('settings.vibration')}
          checked={settings.vibration}
          onChange={(value) => {
            update({ vibration: value });
          }}
        />
        <Toggle
          label={t('settings.leftHanded')}
          checked={settings.leftHanded}
          onChange={(value) => {
            update({ leftHanded: value });
          }}
        />
        <Select<ThemePreference>
          label={t('settings.theme')}
          value={settings.theme}
          onChange={(value) => {
            update({ theme: value });
          }}
          options={[
            { value: 'system', label: t('settings.theme.system') },
            { value: 'dark', label: t('settings.theme.dark') },
            { value: 'light', label: t('settings.theme.light') },
          ]}
        />
        <Select<Locale>
          label={t('settings.language')}
          value={settings.locale}
          onChange={(value) => {
            update({ locale: value });
          }}
          options={[
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>

      {/* Der Menuepunkt fuer die Werbeeinwilligung wird in Meilenstein 4 angeschlossen
          und nur dann angezeigt, wenn die UMP-SDK ihn verlangt. */}

      <div className="mt-8">
        <Button
          variant="ghost"
          full
          onClick={() => {
            setConfirmClear(true);
          }}
        >
          {t('settings.clearData')}
        </Button>
      </div>

      {confirmClear ? (
        <Dialog
          title={t('settings.clearData')}
          onDismiss={() => {
            setConfirmClear(false);
          }}
          actions={
            <>
              <Button
                variant="primary"
                full
                onClick={() => {
                  setConfirmClear(false);
                  void useAppStore.getState().clearProgress();
                }}
              >
                {t('common.confirm')}
              </Button>
              <Button
                variant="ghost"
                full
                onClick={() => {
                  setConfirmClear(false);
                }}
              >
                {t('common.cancel')}
              </Button>
            </>
          }
        >
          {t('settings.clearDataConfirm')}
        </Dialog>
      ) : null}
    </ScreenFrame>
  );
}
