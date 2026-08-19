/**
 * Union-Find mit Pfadkompression und Union-by-Size.
 * Wird fuer die Zusammenhangspruefung (Gewinnbedingung) und im Solver benutzt;
 * die Instanz ist wiederverwendbar, damit in heissen Schleifen nichts allokiert wird.
 */
export class UnionFind {
  private readonly parent: Int32Array;
  private readonly size: Int32Array;
  private componentCount: number;

  constructor(elementCount: number) {
    this.parent = new Int32Array(elementCount);
    this.size = new Int32Array(elementCount);
    this.componentCount = elementCount;
    this.reset();
  }

  /** Setzt alle Elemente auf eigene Komponenten zurueck. */
  reset(): void {
    for (let i = 0; i < this.parent.length; i++) {
      this.parent[i] = i;
      this.size[i] = 1;
    }
    this.componentCount = this.parent.length;
  }

  find(element: number): number {
    let root = element;
    while (this.parent[root] !== root) {
      root = this.parent[root]!;
    }
    // Pfadkompression
    let current = element;
    while (this.parent[current] !== root) {
      const next = this.parent[current]!;
      this.parent[current] = root;
      current = next;
    }
    return root;
  }

  /** Vereinigt zwei Mengen; liefert false, wenn sie bereits verbunden waren. */
  union(left: number, right: number): boolean {
    const a = this.find(left);
    const b = this.find(right);
    if (a === b) {
      return false;
    }
    const [big, small] = this.size[a]! >= this.size[b]! ? [a, b] : [b, a];
    this.parent[small] = big;
    this.size[big] = this.size[big]! + this.size[small]!;
    this.componentCount--;
    return true;
  }

  connected(left: number, right: number): boolean {
    return this.find(left) === this.find(right);
  }

  /** Groesse der Komponente, zu der das Element gehoert. */
  componentSize(element: number): number {
    return this.size[this.find(element)]!;
  }

  get components(): number {
    return this.componentCount;
  }
}
