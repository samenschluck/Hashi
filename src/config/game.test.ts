import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, DIFFICULTIES, HINTS, MAX_BRIDGES_PER_EDGE, MAX_ISLAND_VALUE } from './game.ts';

// Rauchtest fuer das Projektgeruest: stellt sicher, dass die zentralen
// Balancing-Werte vorhanden und plausibel sind.
describe('Spielkonfiguration', () => {
  it('kennt genau vier Schwierigkeitsgrade mit den vorgegebenen Boardgroessen', () => {
    expect([...DIFFICULTIES]).toEqual(['easy', 'medium', 'hard', 'expert']);
    expect(BOARD_SIZE).toEqual({ easy: 7, medium: 10, hard: 13, expert: 17 });
  });

  it('haelt die Hashiwokakero-Grenzwerte ein', () => {
    expect(MAX_ISLAND_VALUE).toBe(8);
    expect(MAX_BRIDGES_PER_EDGE).toBe(2);
    // Eine Insel kann hoechstens vier Nachbarn haben, je zwei Bruecken.
    expect(MAX_ISLAND_VALUE).toBe(4 * MAX_BRIDGES_PER_EDGE);
  });

  it('startet mit einem Tipp-Guthaben groesser null', () => {
    expect(HINTS.initialBalance).toBeGreaterThan(0);
    expect(HINTS.rewardedGrant).toBeGreaterThan(0);
  });
});
