import de from './de.json';
import en from './en.json';
import type { Locale } from '../core/progression.ts';

/**
 * Sehr schlanke Uebersetzung: ein flaches Woerterbuch je Sprache und
 * Platzhalter der Form `{name}`. Fuer den Umfang dieser App braucht es keine
 * Bibliothek — und jede eingesparte Abhaengigkeit ist eine weniger, die im
 * Play-Release Probleme machen kann.
 */

export type TranslationKey = keyof typeof de;

const dictionaries: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  de,
  en,
};

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  // Faellt eine Uebersetzung, wird der deutsche Text benutzt; fehlt auch der,
  // steht der Schluessel da. Beides ist haesslich, aber nie ein Absturz.
  const text = dictionaries[locale][key] ?? dictionaries.de[key] ?? key;
  if (!params) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Sprache aus den Systemeinstellungen, sofern unterstuetzt. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'de';
  }
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}
