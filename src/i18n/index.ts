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
  // Fehlt eine Uebersetzung, wird der englische Text benutzt; fehlt auch der,
  // der deutsche; zuletzt steht der Schluessel da. Haesslich, aber nie ein
  // Absturz — und Englisch als Rueckfall, weil es mehr Leute lesen koennen.
  const text = dictionaries[locale][key] ?? dictionaries.en[key] ?? dictionaries.de[key] ?? key;
  if (!params) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Sprachkennungen aus den Systemeinstellungen auf eine unterstuetzte Sprache
 * abbilden.
 *
 * Regel: **nur** ein deutschsprachiges Geraet bekommt Deutsch, alles andere
 * Englisch. Englisch ist hier nicht die zweite Wahl, sondern der Rueckfall fuer
 * jede nicht unterstuetzte Sprache — ein Geraet auf Portugiesisch startet auf
 * Englisch, nicht auf Deutsch.
 *
 * Massgeblich ist allein der **erste** Eintrag der Liste. Steht Deutsch erst an
 * zweiter Stelle, ist es nicht die Sprache des Geraets, sondern eine
 * Zweitsprache — und dann ist Englisch die bessere Wahl.
 */
export function pickLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    // `de`, `de-AT`, `de_DE` und die ISO-639-2-Formen `deu`/`ger`.
    const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (primary === undefined || primary === '') {
      continue;
    }
    return primary === 'de' || primary === 'deu' || primary === 'ger' ? 'de' : 'en';
  }
  return 'en';
}

/**
 * Sprache aus den Systemeinstellungen.
 *
 * `navigator.languages` folgt in der Android-WebView der Spracheinstellung des
 * Geraets. `navigator.language` haengt als Rueckfall hinten dran, falls die
 * Liste leer ist. Ohne `navigator` — also im Test oder beim Vorab-Rendern —
 * gilt Englisch.
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  return pickLocale([...navigator.languages, navigator.language]);
}
