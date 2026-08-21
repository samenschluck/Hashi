import type { ReactNode } from 'react';

/**
 * Kleine gemeinsame Bausteine der Oberflaeche.
 *
 * Alle Bedienelemente sind mindestens 48 dp hoch (`min-h-12`) — das ist die
 * Android-Vorgabe und der Grund, warum hier nirgends kleinere Knoepfe stehen.
 */

export interface ButtonProps {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  readonly disabled?: boolean;
  readonly full?: boolean;
}

const VARIANTS: Readonly<Record<NonNullable<ButtonProps['variant']>, string>> = {
  primary: 'bg-sky-500 text-slate-950 hover:bg-sky-400',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800',
};

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  full = false,
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 min-w-0 rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-40 ${VARIANTS[variant]} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

export interface ScreenFrameProps {
  readonly title: string;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

/** Grundgeruest aller Menuebildschirme: Kopfzeile, scrollbarer Inhalt, Fussbereich. */
export function ScreenFrame({
  title,
  onBack,
  backLabel = 'Zurück',
  children,
  footer,
}: ScreenFrameProps): React.JSX.Element {
  return (
    <div className="screen-column flex h-full flex-col">
      <header className="flex items-center gap-2 px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="-ml-2 flex min-h-12 min-w-12 items-center justify-center rounded-xl text-2xl text-slate-300"
          >
            ‹
          </button>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      {footer ? <div className="px-4 pb-3">{footer}</div> : null}
    </div>
  );
}

export interface ToggleProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
  readonly description?: string;
}

export function Toggle({ label, checked, onChange, description }: ToggleProps): React.JSX.Element {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2">
      <span className="flex flex-col">
        <span className="text-sm text-slate-100">{label}</span>
        {description ? <span className="text-xs text-slate-400">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="h-6 w-11 appearance-none rounded-full bg-slate-700 transition-colors before:block before:h-5 before:w-5 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-slate-300 before:transition-transform checked:bg-sky-500 checked:before:translate-x-5.5"
      />
    </label>
  );
}

export interface SelectProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectProps<T>): React.JSX.Element {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate-100">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
        className="min-h-10 rounded-lg bg-slate-800 px-3 text-sm text-slate-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface DialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly actions: ReactNode;
  readonly onDismiss: () => void;
}

export function Dialog({ title, children, actions, onDismiss }: DialogProps): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 px-6"
      role="dialog"
      aria-modal="true"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-slate-900 p-5 shadow-xl"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-2 text-sm text-slate-300">{children}</div>
        <div className="mt-5 flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** Kurze Rueckmeldung am oberen Rand, verschwindet von selbst. */
export function Notice({ message }: { readonly message: string }): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-4">
      <span className="rounded-full bg-slate-800/95 px-4 py-2 text-center text-sm text-slate-100 shadow-lg">
        {message}
      </span>
    </div>
  );
}

interface StarsProps {
  readonly earned: number;
  /** Kantenlaenge in Tailwind-Einheiten, z. B. `text-2xl`. */
  readonly size?: string;
  readonly label: string;
}

/**
 * Sternebewertung als Text, nicht als Grafik.
 *
 * Bewusst mit ausgeschriebenem `aria-label`: Ein Bildschirmleser soll „2 von 3
 * Sternen" vorlesen und nicht dreimal „Stern". Die Sterne selbst sind fuer ihn
 * ausgeblendet.
 */
export function Stars({ earned, size = 'text-2xl', label }: StarsProps): React.JSX.Element {
  return (
    <span className={`inline-flex gap-0.5 ${size}`} role="img" aria-label={label}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={index < earned ? 'text-amber-400' : 'text-slate-600'}
        >
          {index < earned ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}
