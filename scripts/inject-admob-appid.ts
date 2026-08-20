/**
 * Schreibt die AdMob-App-ID in die Android-Ressourcen.
 *
 * **Warum ueberhaupt ein Skript?** Die App-ID ist keine Laufzeitgroesse. Das
 * Google-Mobile-Ads-SDK liest sie beim Start aus dem `AndroidManifest.xml`:
 *
 * ```xml
 * <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
 *            android:value="@string/admob_app_id"/>
 * ```
 *
 * Sie kann deshalb nicht wie die Ad-Unit-IDs ueber `import.meta.env` in den
 * Web-Bundle wandern. Das Manifest verweist auf eine Ressource, und dieses
 * Skript schreibt den Wert vor dem Build dort hinein. Fehlt die ID, stuerzt die
 * App beim Start ab — deshalb steht Googles Test-ID als Standard drin.
 *
 * Aufruf: `npm run android:prepare` (oder direkt `node scripts/inject-admob-appid.ts`)
 * Quelle des Werts: `ADMOB_APP_ID` aus der Umgebung oder aus `.env`.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_APP_ID } from '../src/services/adConfig.ts';

const here = dirname(fileURLToPath(import.meta.url));
const resourceFile = resolve(here, '../android/app/src/main/res/values/admob.xml');
const envFile = resolve(here, '../.env');

/** Liest `ADMOB_APP_ID` aus einer .env-Datei, ohne eine Bibliothek dafuer zu brauchen. */
async function readFromEnvFile(): Promise<string | undefined> {
  try {
    const content = await readFile(envFile, 'utf8');
    for (const line of content.split('\n')) {
      const match = /^\s*ADMOB_APP_ID\s*=\s*(.*)\s*$/.exec(line);
      if (match) {
        const value = (match[1] ?? '').trim().replace(/^["']|["']$/g, '');
        return value.length > 0 ? value : undefined;
      }
    }
  } catch {
    // Keine .env vorhanden — das ist der Normalfall auf einem frischen Rechner.
  }
  return undefined;
}

function isPlausibleAppId(value: string): boolean {
  // Format laut AdMob: ca-app-pub-<16 Ziffern>~<10 Ziffern>
  return /^ca-app-pub-\d{16}~\d{10}$/.test(value);
}

async function main(): Promise<void> {
  const fromEnvironment = process.env['ADMOB_APP_ID'];
  const appId = fromEnvironment ?? (await readFromEnvFile()) ?? TEST_APP_ID;

  if (!isPlausibleAppId(appId)) {
    throw new Error(
      `ADMOB_APP_ID sieht nicht wie eine AdMob-App-ID aus: "${appId}". ` +
        'Erwartet wird das Format ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY.',
    );
  }

  const isTestId = appId === TEST_APP_ID;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Erzeugt von scripts/inject-admob-appid.ts — nicht von Hand aendern.
  Der Wert stammt aus ADMOB_APP_ID (Umgebung oder .env).
-->
<resources>
    <string name="admob_app_id" translatable="false">${appId}</string>
</resources>
`;

  await mkdir(dirname(resourceFile), { recursive: true });
  await writeFile(resourceFile, xml, 'utf8');

  console.log(
    isTestId
      ? `AdMob-App-ID: Googles Test-ID eingetragen (${appId}).\n` +
          'Fuer ein Release muss ADMOB_APP_ID auf die echte ID gesetzt werden.'
      : `AdMob-App-ID eingetragen (${appId.slice(0, 18)}…).`,
  );
}

await main();
