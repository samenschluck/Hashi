import { describe, expect, it } from 'vitest';
import { pickLocale, translate } from './index.ts';
import { DEFAULT_SETTINGS } from '../core/progression.ts';

describe('pickLocale', () => {
  it('waehlt Deutsch nur fuer deutschsprachige Geraete', () => {
    for (const tag of ['de', 'de-DE', 'de-AT', 'de-CH', 'DE-de', 'de_DE', 'deu', 'ger']) {
      expect(pickLocale([tag])).toBe('de');
    }
  });

  it('waehlt Englisch fuer jede andere Sprache', () => {
    // Der eigentliche Fehler aus dem Test durch die Tester: Ein Geraet, das
    // weder deutsch noch englisch eingestellt ist, startete auf Deutsch.
    for (const tag of ['en', 'en-US', 'fr-FR', 'pt-BR', 'tr', 'hi-IN', 'zh-Hans-CN', 'ar']) {
      expect(pickLocale([tag])).toBe('en');
    }
  });

  it('richtet sich nach der ersten Sprache, nicht nach einer Zweitsprache', () => {
    // Deutsch an zweiter Stelle ist nicht die Sprache des Geraets.
    expect(pickLocale(['fr-FR', 'de-DE'])).toBe('en');
    expect(pickLocale(['de-AT', 'en-US'])).toBe('de');
  });

  it('kommt mit leerer oder unsinniger Liste zurecht', () => {
    expect(pickLocale([])).toBe('en');
    expect(pickLocale(['', '  '])).toBe('en');
    expect(pickLocale(['', 'de-DE'])).toBe('de');
    expect(pickLocale(['-'])).toBe('en');
  });
});

describe('Voreinstellung', () => {
  it('ist Englisch und gilt nicht als Wahl des Spielers', () => {
    // Beides zusammen ergibt das gewuenschte Verhalten: Ohne erkennbare
    // Systemsprache Englisch, und die Erkennung darf beim Start nachbessern.
    expect(DEFAULT_SETTINGS.locale).toBe('en');
    expect(DEFAULT_SETTINGS.localeChosen).toBe(false);
  });
});

describe('translate', () => {
  it('liefert je Sprache einen eigenen Text', () => {
    expect(translate('de', 'settings.language')).toBe('Sprache');
    expect(translate('en', 'settings.language')).toBe('Language');
  });

  it('setzt Platzhalter ein', () => {
    expect(translate('en', 'game.hintsLeft', { count: 3 })).toContain('3');
  });
});
