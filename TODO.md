# Offene Punkte bis zur Veröffentlichung

Diese Liste sammelt alles, was **vor** der Veröffentlichung im Play Store erledigt sein
muss und nicht im Code steckt. Der Code selbst ist fertig — Stand siehe `PROGRESS.md`.

---

## 🔴 Blockiert die Veröffentlichung

### 1. Name und ladungsfähige Anschrift in die Datenschutzerklärung — ✅ erledigt

Eingetragen am 20.08.2026 in `docs/datenschutz.html` und `docs/privacy.html`:
Verantwortlicher mit Name, Anschrift und Kontakt-E-Mail. Der rote Platzhalter ist
entfallen, die zugehörige CSS-Klasse `.todo` ebenfalls.

**Bei jeder inhaltlichen Änderung** an einer der beiden Fassungen auch das Datum unter
„Stand" bzw. „Last updated" mitziehen — und die jeweils andere Sprachfassung nachziehen.

### 2. Echte AdMob-IDs und veröffentlichte DSGVO-Nachricht — ✅ erledigt

- App-ID, Banner-Unit-ID, Rewarded-Unit-ID aus der AdMob-Konsole ✅
- EU-Einwilligungsnachricht angelegt **und veröffentlicht** ✅ (unveröffentlicht liefert
  `showConsentForm()` nichts zurück)
- IDs als GitHub-Secrets hinterlegt ✅

Ob der Einwilligungsdialog tatsächlich erscheint, zeigt erst der Gerätetest.

**Die echten IDs gehören nicht ins Repository.** Es ist öffentlich, und veröffentlichte
Werbe-IDs laden dazu ein, sie in fremden Apps für ungültigen Traffic zu missbrauchen —
gesperrt würde dann das eigene AdMob-Konto. Sie gehören ausschließlich in die lokale
`.env` (gitignored) und in die GitHub-Secrets.

### 3. Release-Keystore — ✅ erledigt

- Erzeugt, Alias `bridgelet`, gültig bis Januar 2054 ✅
- Als vier Secrets in GitHub hinterlegt ✅
- Der erste Release-Build (20.08.2026) bestätigt die Signatur mit dem Release-Schlüssel ✅

**Weiter sicher aufbewahren.** Mit Play App Signing ist er nur der Upload-Schlüssel und
liesse sich über den Play-Support zurücksetzen — angenehm ist das trotzdem nicht.

### 4. Test auf einem echten Gerät — ✅ Debug-Build geprüft

**Erledigt am 20.08.2026** über eine Debug-APK aus Android Studio. Geprüft und in
Ordnung:

- Bedienung, Darstellung und Ablauf auf echter Hardware
- Einwilligungsdialog erscheint direkt beim ersten Start, **vor** der ersten
  Anzeigenanfrage
- Banner lädt und überlagert nichts
- Belohntes Video läuft und schreibt die Tipps gut

Damit ist die vollständige Kette Einwilligung → Anzeigenanfrage → Banner → belohntes
Video → Gutschrift einmal nachgewiesen.

**Eine Restposition bleibt: die eigene DSGVO-Nachricht.** Die UMP-Bibliothek lädt die
Einwilligungskonfiguration anhand der App-ID aus dem Manifest, und im Debug-Build steht
dort Googles Test-App-ID. Der gesehene Dialog belegt also den _Ablauf_, nicht die eigene
veröffentlichte Nachricht. Das zeigt erst ein Build mit der echten App-ID, also der
interne Test in der Play Console.

**Ein AAB lässt sich nicht direkt auf ein Telefon installieren** — es ist ein Format für
die Play Console, kein Installationspaket. Zwei Wege zum Gerät:

- **Debug-APK** über Android Studio: zeigt Test-Anzeigen, Klicks darauf sind
  unbedenklich. Der richtige Weg für Bedienung, Bildrate und Spielgefühl.
- **Interner Test in der Play Console**: das AAB hochladen und über den Play-Link
  installieren. Nur so lassen sich echter Einwilligungsdialog, echte Anzeigen und
  belohntes Video prüfen — dort dann **nie selbst auf eine Anzeige klicken**.

Was in der Entwicklungsumgebung nicht prüfbar war:

- 60 fps auf Mid-Range-Hardware, Touch-Gefühl
- Einwilligungsdialog erscheint tatsächlich
- Banner überlagert nichts, belohntes Video schreibt Tipps gut
- Fortschritt überlebt ein Force-Close

### 5. Play-Console-Formulare

- Datenschutz-URL eintragen (`https://samenschluck.github.io/Hashi/datenschutz.html`)
- Datensicherheit nach `store/data-safety.md`
- Content-Rating nach `store/content-rating.md`
- „Diese App enthält Werbung" anhaken
- `versionCode` vor jedem Upload erhöhen

---

## 🟡 Erledigt, aber im Blick behalten

- **Markenprüfung „Bridgelet"** — WIPO, TMview, DPMAregister und Play Store durchsucht,
  keine Treffer. Der Halbleiter-Hersteller CrossFire benutzt den Begriff für ein
  patentiertes Bauteil; andere Warenklasse, andere Abnehmer. Keine Rechtsberatung.
- **Bundle-ID `com.bridgelet.game`** — nach dem ersten Upload unveränderlich.
- **Browser-Fassung unter `docs/play/`** — eingecheckter Web-Build zum Testen ohne Gerät.
  Nach Änderungen am Spiel mit `npm run pages:play` neu erzeugen, sonst zeigt die
  öffentliche Seite einen veralteten Stand. Darf vor dem Release gelöscht werden.

---

## ⚪ Optional, später

- `app-ads.txt` in der Play-Console-Website hinterlegen (verbessert die AdMob-Erlöse)
- Kauf „Werbung entfernen" — das Kennzeichen `adsRemoved` ist im Code bereits vorgesehen
  und wird vom Banner respektiert, der Kauf selbst ist nicht implementiert
- iOS — die Architektur ist darauf vorbereitet, alle nativen Zugriffe laufen über
  Service-Wrapper in `src/services/`
