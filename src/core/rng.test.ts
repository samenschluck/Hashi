import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';

describe('createRng', () => {
  it('liefert zum selben Seed dieselbe Folge', () => {
    const first = createRng('seed-1');
    const second = createRng('seed-1');
    const a = Array.from({ length: 50 }, () => first.nextUint32());
    const b = Array.from({ length: 50 }, () => second.nextUint32());
    expect(a).toEqual(b);
  });

  it('liefert zu verschiedenen Seeds verschiedene Folgen', () => {
    const first = createRng('seed-1');
    const second = createRng('seed-2');
    const a = Array.from({ length: 20 }, () => first.nextUint32());
    const b = Array.from({ length: 20 }, () => second.nextUint32());
    expect(a).not.toEqual(b);
  });

  it('bleibt in den zugesagten Wertebereichen', () => {
    const rng = createRng('bereiche');
    for (let i = 0; i < 1000; i++) {
      const float = rng.nextFloat();
      expect(float).toBeGreaterThanOrEqual(0);
      expect(float).toBeLessThan(1);

      const int = rng.nextInt(7);
      expect(int).toBeGreaterThanOrEqual(0);
      expect(int).toBeLessThan(7);

      const ranged = rng.nextRange(3, 5);
      expect(ranged).toBeGreaterThanOrEqual(3);
      expect(ranged).toBeLessThanOrEqual(5);
    }
  });

  it('mischt reproduzierbar und verliert dabei keine Elemente', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = [...source];
    const b = [...source];
    createRng('mischen').shuffle(a);
    createRng('mischen').shuffle(b);

    expect(a).toEqual(b);
    expect([...a].sort((left, right) => left - right)).toEqual(source);
  });

  it('meldet unsinnige Grenzen als Fehler', () => {
    const rng = createRng('fehler');
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
