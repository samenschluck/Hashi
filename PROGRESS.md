# PROGRESS.md — Bridgelet

Stand: 2026-08-19

## Erledigt

- `PLAN.md` erstellt und freigegeben: Architektur, Ordnerstruktur, Datenmodell,
  Algorithmen (Solver, Generator, Deduktionen, Tipp-System), Ads-Architektur,
  Build-/CI-Konzept, Meilensteine, Testplan.
- Tech-Stack gegen die npm-Registry verifiziert (Capacitor 8.5.0, AdMob-Plugin 8.1.0,
  Vite 8, Tailwind 4, Vitest 4, Zustand 5, React 19.2).
- AdMob-Plugin-API aus den ausgelieferten Typdefinitionen von
  `@capacitor-community/admob@8.1.0` gelesen statt aus dem Gedächtnis rekonstruiert.
- Entscheidungen E1–E8 getroffen (siehe `PLAN.md`, Abschnitt 10).

## Offen

- **M0** Projektgerüst, Toolchain, CI
- **M1** `src/core/`: Spiellogik, Solver, Generator
- **M2** Canvas-Rendering und Touch-Eingabe
- **M3** Spielfluss, Meta, Persistenz, Tipp-System
- **M4** AdMob: Consent, Banner, Rewarded
- **M5** Android-Build und Store-Readiness

## Bekannte Probleme

- Kein Android SDK in der Entwicklungsumgebung: Der Gradle-/AAB-Build ist nur über den
  GitHub-Actions-Workflow verifizierbar, nicht lokal. Gerätetests (Touch-Gefühl, 60 fps,
  echte Ads) kann ich nicht durchführen.

## Entscheidungen, die noch beim Betreiber liegen

- Marken-/Namensprüfung für „Bridgelet" vor dem Play-Upload (ich leiste keine
  Rechtsberatung).
- AdMob-Konto: echte App-ID, Ad-Unit-IDs und die GDPR-Nachricht in der AdMob-Konsole.
  Ohne konfigurierte Nachricht liefert `showConsentForm()` nichts.
- Play Console: Datenschutzerklärung veröffentlichen, Data-Safety- und
  Content-Rating-Angaben verantworten. Ich liefere ausgefüllte Vorlagen.
- Release-Keystore erzeugen und als GitHub-Secret hinterlegen.
