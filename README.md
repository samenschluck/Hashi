# Bridgelet

Ein ruhiges Brücken-Logikrätsel (Hashiwokakero) für Android. Web-App auf Basis von
React und Vite, als native App über Capacitor verpackt, finanziert über AdMob.

- **Kein Zeitdruck, keine Verlierbedingung.** Es gibt weder Leben noch Timeout.
- **600 vorgenerierte Rätsel**, 150 je Schwierigkeitsgrad — jedes mit garantiert
  genau einer Lösung, per Solver geprüft.
- **Vollständig offline spielbar.** Kein Konto, kein Backend.

Architektur, Entscheidungen und Messwerte stehen in [`PLAN.md`](PLAN.md), der
Stand der Arbeit in [`PROGRESS.md`](PROGRESS.md).

---

## Voraussetzungen

| Werkzeug       | Version             | wofür                         |
| -------------- | ------------------- | ----------------------------- |
| Node.js        | 22 (siehe `.nvmrc`) | alles                         |
| JDK            | 21                  | Android-Build                 |
| Android SDK    | Platform 36         | Android-Build                 |
| Android Studio | aktuell             | bequemer, aber nicht zwingend |

Für den reinen Web-Teil reicht Node.

## Loslegen

```bash
npm install
npm run dev          # http://localhost:5173
```

Das Spiel ist im Browser vollständig bedienbar. Alle nativen Zugriffe (Werbung,
Speicher, Vibration) laufen über Wrapper in `src/services/` mit Web-Fallback — im
Browser erscheint statt des Banners ein Platzhalter derselben Höhe, und ein
belohntes Video wird simuliert.

## Alltägliche Befehle

| Befehl                      | Wirkung                                                 |
| --------------------------- | ------------------------------------------------------- |
| `npm run dev`               | Entwicklungsserver                                      |
| `npm run build`             | Typprüfung und Produktions-Build nach `dist/`           |
| `npm test`                  | Unit-Tests (Vitest)                                     |
| `npm run test:perf`         | Laufzeitmessung der Rätselgenerierung                   |
| `npm run lint`              | ESLint                                                  |
| `npm run format`            | Prettier                                                |
| `npm run puzzles:generate`  | Erzeugt die 600 ausgelieferten Rätsel neu               |
| `npm run puzzles:verify`    | Prüft jedes ausgelieferte Rätsel gegen den Solver       |
| `npm run ui:check`          | Rauchtest im echten Browser (`npm run dev` muss laufen) |
| `npm run store:screenshots` | Erzeugt die Play-Store-Screenshots                      |

## Projektaufbau

```
src/
├─ core/       reine Spiellogik: Regeln, Solver, Generator, Tipps — ohne React,
│              ohne Capacitor, ohne DOM (per ESLint erzwungen)
├─ render/     Canvas-Renderer und Sichtgeometrie, ohne React
├─ input/      Gestenerkennung, ohne DOM
├─ services/   einziger Kontakt zu nativen APIs, jeweils mit Web-Fallback
├─ state/      Zustand-Stores
├─ ui/         React-Komponenten und Bildschirme
├─ data/       die ausgelieferten Rätsel als JSON
├─ i18n/       Übersetzungen DE/EN
└─ config/     alle Balancing-Werte an einer Stelle
```

---

## Android

### Einmalige Einrichtung

```bash
npm run android:prepare      # AdMob-App-ID eintragen, Web-Build, cap sync
npx cap open android         # Android Studio öffnen (optional)
```

`android:prepare` erledigt drei Dinge:

1. `ads:inject-appid` schreibt die AdMob-App-ID nach
   `android/app/src/main/res/values/admob.xml`,
2. `build` erzeugt den Web-Build,
3. `cap sync android` kopiert ihn ins Android-Projekt und aktualisiert die Plugins.

**Warum ein Skript für die App-ID?** Das Google-Mobile-Ads-SDK liest sie beim Start
aus dem `AndroidManifest.xml` und nicht zur Laufzeit. Sie kann deshalb nicht wie
die Ad-Unit-IDs über `import.meta.env` in den Web-Bundle wandern. Ohne gesetzte ID
stürzt die App beim Start ab — deshalb steht standardmäßig Googles Test-ID drin.

### Debug-Build

```bash
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Der Debug-Build bekommt die Anwendungs-ID `com.bridgelet.game.debug` und kann
deshalb parallel zur Release-Version installiert werden.

### Release-Schlüssel erzeugen

Einmalig, und **die Datei niemals verlieren**: ohne sie lässt sich die App später
nicht mehr aktualisieren.

```bash
keytool -genkey -v \
  -keystore bridgelet-release.keystore \
  -alias bridgelet \
  -keyalg RSA -keysize 2048 -validity 10000
```

Die Datei gehört **nicht** ins Repository (`*.keystore` ist in `.gitignore`).
Sichere Aufbewahrung: Passwortmanager oder verschlüsselter Offline-Speicher.

Danach `android/keystore.properties` anlegen (ebenfalls gitignored):

```properties
storeFile=/absoluter/pfad/zu/bridgelet-release.keystore
storePassword=…
keyAlias=bridgelet
keyPassword=…
```

Fehlt diese Datei, signiert Gradle den Release-Build mit dem Debug-Schlüssel. Der
Build läuft dann durch, die Play Console lehnt ihn aber ab — das ist Absicht, damit
ein Fehler auffällt und nicht stillschweigend etwas Falsches hochgeladen wird.

### Release-Build (AAB)

```bash
ADMOB_APP_ID=ca-app-pub-… \
VITE_ADMOB_BANNER_ID=ca-app-pub-…/… \
VITE_ADMOB_REWARDED_ID=ca-app-pub-…/… \
VITE_ADMOB_TESTING=false \
npm run android:prepare

cd android && ./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

Prüfen, mit welchem Schlüssel signiert wurde:

```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

Steht dort `CN=Android Debug`, wurde ohne Release-Schlüssel gebaut.

### Release über GitHub Actions

Der Workflow **Android Release (AAB)** ist manuell auslösbar
(Actions → Android Release → Run workflow) und lädt das fertige AAB als Artefakt
hoch. Dafür müssen diese Repository-Secrets gesetzt sein:

| Secret                      | Inhalt                                  |
| --------------------------- | --------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 bridgelet-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Passwort des Keystores                  |
| `ANDROID_KEY_ALIAS`         | Alias, z. B. `bridgelet`                |
| `ANDROID_KEY_PASSWORD`      | Passwort des Schlüssels                 |
| `ADMOB_APP_ID`              | echte AdMob-App-ID                      |
| `ADMOB_BANNER_ID`           | echte Banner-Unit-ID                    |
| `ADMOB_REWARDED_ID`         | echte Rewarded-Unit-ID                  |

---

## Werbung einrichten

1. In der [AdMob-Konsole](https://apps.admob.com) eine App anlegen und drei Werte
   notieren: App-ID, Banner-Unit-ID, Rewarded-Unit-ID.
2. `.env.example` nach `.env` kopieren und die Werte eintragen. `.env` ist
   gitignored.
3. **DSGVO-Nachricht konfigurieren:** AdMob-Konsole → Datenschutz & Nachrichten →
   _EU-Einwilligungsnachricht_ anlegen und veröffentlichen. Ohne diesen Schritt
   liefert `showConsentForm()` nichts, und der Einwilligungsdialog erscheint nie.
4. Zum Testen auf einem echten Gerät die Geräte-ID aus dem Logcat in
   `VITE_ADMOB_TEST_DEVICES` eintragen und mit `VITE_ADMOB_DEBUG_GEOGRAPHY=EEA`
   den europäischen Einwilligungsdialog erzwingen.

> **Nie mit echten IDs testen.** Ein Klick auf eine echte Anzeige im eigenen Gerät
> gilt als ungültiger Traffic und kann das AdMob-Konto kosten. Solange keine echten
> IDs gesetzt sind, bleibt die App zwangsweise im Testmodus — auch dann, wenn
> `VITE_ADMOB_TESTING=false` gesetzt ist.

---

## Erster Upload in die Play Console

1. **Entwicklerkonto** anlegen (einmalige Gebühr) und Identität verifizieren.
2. **App erstellen:** Name „Bridgelet", Standardsprache, Typ _Spiel_, kostenlos.
3. **Store-Eintrag** aus `store/listing-de.md` und `store/listing-en.md` übernehmen.
   Grafiken: `assets/icon.png` (512×512 als Store-Icon), `store/feature-graphic.png`,
   Screenshots aus `store/screenshots/de` beziehungsweise `store/screenshots/en`.
4. **App-Inhalte** ausfüllen:
   - Datenschutzerklärung veröffentlichen und URL eintragen (siehe unten),
   - Datensicherheit nach `store/data-safety.md`,
   - Content-Rating nach `store/content-rating.md`,
   - Werbung: „Diese App enthält Werbung" **anhaken**,
   - Zielgruppe: nicht vorrangig Kinder.
5. **AAB hochladen** — zuerst in einen internen Test-Track, nicht direkt in die
   Produktion.
6. **Play App Signing** akzeptieren. Google übernimmt dann den finalen
   Signaturschlüssel; der eigene Keystore bleibt trotzdem für Uploads nötig.
7. Nach dem Test in die Produktion befördern.

Die Bundle-ID `com.bridgelet.game` ist nach dem ersten Upload **unveränderlich**.

---

## Datenschutzerklärung veröffentlichen

Sowohl AdMob (beim Anlegen der DSGVO-Nachricht) als auch die Play Console verlangen eine
**öffentlich erreichbare URL**. Die fertigen Seiten liegen unter `docs/` und werden über
GitHub Pages ausgeliefert.

**Einmalig einschalten:** Settings → Pages → Source: _Deploy from a branch_ →
Branch `main`, Ordner `/docs` → Save. Nach ein bis zwei Minuten sind erreichbar:

| Seite                     | URL                                                     |
| ------------------------- | ------------------------------------------------------- |
| Übersicht                 | `https://samenschluck.github.io/Hashi/`                 |
| Datenschutzerklärung (DE) | `https://samenschluck.github.io/Hashi/datenschutz.html` |
| Privacy Policy (EN)       | `https://samenschluck.github.io/Hashi/privacy.html`     |

**Vorher ausfüllen** — in `docs/datenschutz.html` und `docs/privacy.html` stehen drei rot
markierte Platzhalter (`class="todo"`): Datum, Verantwortlicher mit Anschrift, Kontakt-E-Mail.
Die Angabe des Verantwortlichen ist rechtlich erforderlich und lässt sich nicht weglassen.

Die Markdown-Fassungen unter `store/` bleiben als Arbeitsgrundlage bestehen; ausgeliefert wird
das HTML unter `docs/`. Wer eine Fassung ändert, sollte die andere nachziehen.

---

## Vor dem Release prüfen

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run puzzles:verify` grün
- [ ] Echte AdMob-IDs gesetzt, `VITE_ADMOB_TESTING=false`
- [ ] DSGVO-Nachricht in der AdMob-Konsole veröffentlicht
- [ ] `versionCode` erhöht (jeder Upload braucht einen höheren)
- [ ] Auf einem echten Gerät: Einwilligungsdialog erscheint, Banner überlagert
      nichts, belohntes Video schreibt Tipps gut
- [ ] Zurück-Taste auf jedem Bildschirm, Fortschritt überlebt ein Force-Close
- [ ] Marken- und Namensprüfung für „Bridgelet" abgeschlossen
- [ ] Datenschutzerklärung veröffentlicht, Platzhalter ausgefüllt, URL in AdMob und
      Play Console eingetragen

## Lizenz

Noch nicht festgelegt.
