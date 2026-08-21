/**
 * Erzeugt die Screenshots fuer den Play-Store-Eintrag.
 *
 * Faehrt die App im echten Chromium hoch, stellt einen passenden Spielstand ein
 * und fotografiert acht Bildschirme in Play-Store-Massen (1080x1920, also
 * 360x640 bei dreifacher Pixeldichte — das entspricht einem gaengigen Telefon).
 *
 * Voraussetzung: `npm run dev` laeuft.
 * Aufruf: `npm run store:screenshots [-- --locale=en]`
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.APP_URL ?? 'http://127.0.0.1:5173/';
const locale = process.argv.find((value) => value.startsWith('--locale='))?.slice(9) ?? 'de';
const device = process.argv.find((value) => value.startsWith('--device='))?.slice(9) ?? 'phone';

/**
 * Grundflaeche in CSS-Pixeln, dazu die Pixeldichte. Das Produkt ergibt die
 * Bilddatei; Play verlangt mindestens 1080 Pixel an der kurzen Seite.
 */
const devices = {
  phone: { width: 360, height: 640, scale: 3 },
  tablet7: { width: 600, height: 960, scale: 2 },
  tablet10: { width: 800, height: 1280, scale: 2 },
};

const layout = devices[device];
if (!layout) {
  throw new Error(`Unbekanntes Geraet: ${device}. Erlaubt: ${Object.keys(devices).join(', ')}`);
}

const outputDirectory =
  device === 'phone' ? `store/screenshots/${locale}` : `store/screenshots/${locale}-${device}`;

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({
  viewport: { width: layout.width, height: layout.height },
  deviceScaleFactor: layout.scale,
});

const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(url, { waitUntil: 'networkidle' });

// Einen vorzeigbaren Spielstand einstellen: etwas Fortschritt, eine Serie,
// genug Tipps. Ohne das zeigen die Bilder nur leere Listen.
await page.evaluate((chosenLocale) => {
  const app = window.__bridgeletApp;
  const state = app.getState();
  const levels = {};
  for (let index = 1; index <= 23; index++) {
    levels[`easy-${String(index).padStart(4, '0')}`] = {
      solved: true,
      bestTimeMs: 60000 + index * 4200,
      hintsUsed: index % 3,
      undosUsed: index % 2,
      // Gemischte Sterne: die Levelauswahl soll zeigen, dass es etwas zu holen
      // gibt, und nicht wie eine lueckenlose Reihe voller Bestleistungen wirken.
      stars: [3, 2, 3, 1, 2, 3][index % 6],
    };
  }
  app.setState({
    save: {
      ...state.save,
      settings: { ...state.save.settings, locale: chosenLocale },
      levels,
      hints: { ...state.save.hints, balance: 7 },
      daily: {
        streak: 6,
        longestStreak: 11,
        lastSolvedDay: null,
        solvedDays: [],
      },
      stats: {
        solvedTotal: 23,
        totalTimeMs: 23 * 96000,
        hintsSpent: 14,
        solvedByDifficulty: { easy: 14, medium: 6, hard: 2, expert: 1 },
      },
    },
  });
  app.getState().setNotice(null);
}, locale);

await page.waitForTimeout(400);

/**
 * Der Geraetename steht im Dateinamen, nicht nur im Ordner.
 *
 * Beim Hochladen in die Play Console landen alle Saetze im selben
 * Datei-Auswahldialog; ohne Praefix hiessen dort sechs Dateien `01-menue.png`
 * und man laedt zwangslaeufig irgendwann die falsche hoch.
 */
async function shot(name) {
  const file = `${outputDirectory}/${device}-${name}.png`;
  await page.waitForTimeout(500);
  await page.screenshot({ path: file });
  console.log(file);
}

const label = (de, en) => (locale === 'de' ? de : en);

// 1 Hauptmenue
await shot('01-menue');

// 2 Levelauswahl
await page.getByRole('button', { name: label('Spielen', 'Play'), exact: true }).click();
await shot('02-level');

// 3 Spielbildschirm, leeres Brett
await page.getByRole('button', { name: '24', exact: true }).click();
await shot('03-spiel');

// 4 Halb geloestes Brett
await page.evaluate(() => {
  const app = window.__bridgeletApp;
  const game = window.__bridgelet;
  const { puzzle } = app.getState().active;
  const half = Math.ceil(puzzle.solution.length * 0.55);
  for (let index = 0; index < half; index++) {
    if (puzzle.solution[index] > 0) game.getState().setEdge(index, puzzle.solution[index]);
  }
});
await shot('04-fortschritt');

// 5 Tipp mit Begruendung
await page.evaluate(() => {
  window.__bridgeletApp.getState().requestHint();
});
await shot('05-tipp');

// 6 Ergebnisbildschirm
await page.evaluate(() => {
  const app = window.__bridgeletApp;
  const game = window.__bridgelet;
  const { puzzle } = app.getState().active;
  for (let index = 0; index < puzzle.solution.length; index++) {
    if (puzzle.solution[index] > 0) game.getState().setEdge(index, puzzle.solution[index]);
  }
});
await shot('06-geloest');

// 7 Schweres Brett mit Mauern und verborgener Inselzahl — die beiden
// Besonderheiten, die das Spiel von einem gewoehnlichen Hashi unterscheiden.
await page.evaluate(() => {
  window.__bridgeletApp.setState({ screen: 'menu', stack: [] });
});
await page.getByRole('button', { name: label('Spielen', 'Play'), exact: true }).click();
await page.getByRole('button', { name: label('Schwer', 'Hard'), exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '7', exact: true }).click();
await page.evaluate(() => {
  const app = window.__bridgeletApp;
  const game = window.__bridgelet;
  const { puzzle } = app.getState().active;
  const part = Math.ceil(puzzle.solution.length * 0.4);
  for (let index = 0; index < part; index++) {
    if (puzzle.solution[index] > 0) game.getState().setEdge(index, puzzle.solution[index]);
  }
});
await shot('07-schwer');

// 8 Tagesraetsel
await page.evaluate(() => {
  const app = window.__bridgeletApp;
  app.setState({ screen: 'menu', stack: [] });
});
await page.getByRole('button', { name: label('Tagesrätsel', 'Daily puzzle'), exact: true }).click();
await shot('08-tagesraetsel');

// 9 Statistik
await page.evaluate(() => {
  window.__bridgeletApp.setState({ screen: 'menu', stack: [] });
});
await page.getByRole('button', { name: label('Statistik', 'Statistics'), exact: true }).click();
await shot('09-statistik');

if (errors.length > 0) {
  console.error('Fehler auf der Seite:', errors);
  process.exitCode = 1;
}

await browser.close();
