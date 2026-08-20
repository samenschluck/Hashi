/** Farbwerte des Spielfelds. Beide Themen liegen hier zusammen, damit sich der
 * Kontrast an einer Stelle pruefen laesst. */
export interface BoardTheme {
  readonly background: string;
  readonly grid: string;
  readonly island: string;
  readonly islandBorder: string;
  readonly islandText: string;
  readonly islandSatisfied: string;
  readonly islandSatisfiedText: string;
  readonly islandError: string;
  readonly islandErrorText: string;
  readonly selection: string;
  readonly bridge: string;
  readonly bridgePreview: string;
  readonly hint: string;
  /** Gesperrte Zelle, ueber die keine Bruecke laeuft. */
  readonly wall: string;
  readonly wallBorder: string;
}

export const DARK_THEME: BoardTheme = {
  background: '#0f172a',
  grid: '#1e293b',
  island: '#1e293b',
  islandBorder: '#64748b',
  islandText: '#e2e8f0',
  islandSatisfied: '#065f46',
  islandSatisfiedText: '#d1fae5',
  islandError: '#7f1d1d',
  islandErrorText: '#fee2e2',
  selection: '#38bdf8',
  bridge: '#94a3b8',
  bridgePreview: '#38bdf8',
  hint: '#fbbf24',
  wall: '#475569',
  wallBorder: '#94a3b8',
};

export const LIGHT_THEME: BoardTheme = {
  background: '#f8fafc',
  grid: '#e2e8f0',
  island: '#ffffff',
  islandBorder: '#94a3b8',
  islandText: '#0f172a',
  islandSatisfied: '#a7f3d0',
  islandSatisfiedText: '#064e3b',
  islandError: '#fecaca',
  islandErrorText: '#7f1d1d',
  selection: '#0284c7',
  bridge: '#475569',
  bridgePreview: '#0284c7',
  hint: '#b45309',
  wall: '#94a3b8',
  wallBorder: '#475569',
};

export type ThemeName = 'dark' | 'light';

export function themeByName(name: ThemeName): BoardTheme {
  return name === 'light' ? LIGHT_THEME : DARK_THEME;
}
