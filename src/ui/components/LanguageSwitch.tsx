import { useId } from 'react';
import type { Locale } from '../../core/progression.ts';
import { useAppStore } from '../../state/appStore.ts';

/**
 * Sprachwahl als Flaggen.
 *
 * **Warum Flaggen und keine Beschriftung:** Wer die App in einer Sprache
 * vorfindet, die er nicht liest, kann einen Menuepunkt „Einstellungen" nicht
 * finden. Flaggen erkennt er trotzdem — deshalb steht diese Umschaltung direkt
 * im Hauptmenue und nicht nur in den Einstellungen.
 *
 * **Warum gezeichnete Flaggen und keine Emoji:** 🇩🇪 und 🇬🇧 sind Paare aus
 * Regionalindikatoren. Fehlt der Schriftart die Zusammenziehung — auf aelteren
 * Android-Fassungen und manchen Hersteller-Systemen der Fall —, stehen dort
 * statt der Flagge zwei Buchstaben in Kaestchen. Ein SVG zeichnet immer.
 *
 * Die Landesnamen stehen bewusst in der jeweiligen Sprache selbst („Deutsch",
 * nicht „German"): Sie sollen unabhaengig von der eingestellten Sprache lesbar
 * sein.
 */

const LANGUAGES: readonly { readonly locale: Locale; readonly label: string }[] = [
  { locale: 'de', label: 'Deutsch' },
  { locale: 'en', label: 'English' },
];

export interface LanguageSwitchProps {
  /** Ohne Beschriftung wird die Zeile deutlich schmaler — fuer enge Kopfzeilen. */
  readonly compact?: boolean;
}

export function LanguageSwitch({ compact = false }: LanguageSwitchProps): React.JSX.Element {
  const current = useAppStore((store) => store.save.settings.locale);
  const update = useAppStore((store) => store.updateSettings);

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Sprache / Language">
      {LANGUAGES.map(({ locale, label }) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-label={label}
            aria-pressed={active}
            onClick={() => {
              update({ locale });
            }}
            className={`flex min-h-12 items-center gap-2 rounded-xl px-3 transition-colors ${
              active
                ? 'bg-slate-800 text-slate-100 ring-2 ring-sky-500'
                : 'bg-transparent text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Flag locale={locale} dimmed={!active} />
            {compact ? null : <span className="text-sm font-medium">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Flag({
  locale,
  dimmed,
}: {
  readonly locale: Locale;
  readonly dimmed: boolean;
}): React.JSX.Element {
  // Die nicht gewaehlte Flagge wird blasser, bleibt aber farbig — sie ist das
  // Erkennungsmerkmal und darf nicht zu Grau verschwinden.
  const className = `h-4 w-6 shrink-0 rounded-[2px] ring-1 ring-black/30 ${
    dimmed ? 'opacity-60' : ''
  }`;
  return locale === 'de' ? (
    <GermanFlag className={className} />
  ) : (
    <BritishFlag className={className} />
  );
}

function GermanFlag({ className }: { readonly className: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true" focusable="false">
      <rect width="60" height="10" fill="#000000" />
      <rect y="10" width="60" height="10" fill="#DD0000" />
      <rect y="20" width="60" height="10" fill="#FFCE00" />
    </svg>
  );
}

function BritishFlag({ className }: { readonly className: string }): React.JSX.Element {
  // Der Union Jack ist nicht punktsymmetrisch: Die roten Diagonalen sitzen
  // gegenueber der weissen Mitte versetzt. Der Ausschnitt `counterchange`
  // blendet jeweils die Haelfte aus, in der Rot hinter Weiss zurueckspringt.
  // `useId` liefert Zeichen wie « und », die in `url(#…)` je nach WebView
  // Aerger machen koennen. Hier bleibt nur der harmlose Teil uebrig; eindeutig
  // ist er weiterhin, denn der laufende Zaehler steckt in den Ziffern.
  const counterchange = `union-jack-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true" focusable="false">
      <clipPath id={counterchange}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath={`url(#${counterchange})`}
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
