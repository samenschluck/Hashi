/**
 * Deterministischer Zufallszahlengenerator.
 *
 * Absichtlich nicht `Math.random`: Generierung und Tests muessen zu einem Seed
 * bitgenau dasselbe Raetsel liefern, plattform- und laufunabhaengig.
 * Verfahren: cyrb128 als Seed-Ableitung, xoshiro128** als Generator.
 */

export interface Rng {
  /** Naechste vorzeichenlose 32-Bit-Zahl. */
  nextUint32(): number;
  /** Gleichverteilt in [0, 1). */
  nextFloat(): number;
  /** Gleichverteilt in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Gleichverteilt in [minInclusive, maxInclusive]. */
  nextRange(minInclusive: number, maxInclusive: number): number;
  /** Zufaelliges Element; wirft bei leerer Liste. */
  pick<T>(items: readonly T[]): T;
  /** Mischt die Liste in place (Fisher-Yates). */
  shuffle<T>(items: T[]): void;
}

/** Leitet vier 32-Bit-Startwerte aus einem beliebigen Seed-String ab. */
function cyrb128(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/**
 * Erzeugt einen Generator fuer einen Seed. Gleicher Seed = gleiche Zahlenfolge.
 */
export function createRng(seed: string): Rng {
  const [s0, s1, s2, s3] = cyrb128(seed);
  let a = s0;
  let b = s1;
  let c = s2;
  let d = s3;

  // xoshiro128** — schnell, gute Verteilung, ausreichend fuer Raetselgenerierung.
  const nextUint32 = (): number => {
    const t = Math.imul(b, 5);
    const result = (((t << 7) | (t >>> 25)) * 9) >>> 0;
    const shifted = (b << 9) >>> 0;

    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c = (c ^ shifted) >>> 0;
    d = ((d << 11) | (d >>> 21)) >>> 0;

    return result;
  };

  const nextFloat = (): number => nextUint32() / 4294967296;

  const nextInt = (maxExclusive: number): number => {
    if (maxExclusive <= 0) {
      throw new RangeError(
        `nextInt erwartet eine positive Obergrenze, erhielt ${String(maxExclusive)}`,
      );
    }
    return Math.floor(nextFloat() * maxExclusive);
  };

  return {
    nextUint32,
    nextFloat,
    nextInt,
    nextRange: (minInclusive, maxInclusive) =>
      minInclusive + nextInt(maxInclusive - minInclusive + 1),
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) {
        throw new RangeError('pick erwartet eine nicht leere Liste');
      }
      return items[nextInt(items.length)]!;
    },
    shuffle: <T>(items: T[]): void => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = nextInt(i + 1);
        const tmp = items[i]!;
        items[i] = items[j]!;
        items[j] = tmp;
      }
    },
  };
}
