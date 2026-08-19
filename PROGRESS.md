# PROGRESS.md — Hashi

Stand: 2026-08-19

## Erledigt

- `PLAN.md` erstellt: Architektur, Ordnerstruktur, Datenmodell, Algorithmen (Solver,
  Generator, Deduktionen, Tipp-System), Ads-Architektur, Build-/CI-Konzept, Meilensteine,
  Testplan.
- Tech-Stack gegen die npm-Registry verifiziert (Capacitor 8.5.0, AdMob-Plugin 8.1.0,
  Vite 8, Tailwind 4, Vitest 4, Zustand 5).
- AdMob-Plugin-API aus den ausgelieferten Typdefinitionen von `@capacitor-community/admob@8.1.0`
  gelesen statt aus dem Gedächtnis rekonstruiert (Banner, Rewarded, UMP-Consent).
- Umgebung geprüft: Node 22, JDK 21, Gradle vorhanden — **kein Android SDK**.

## Offen

- Alle Meilensteine M0–M5. Implementierung startet nach Freigabe des Plans.

## Bekannte Probleme

- Kein Android SDK in der Entwicklungsumgebung: Der Gradle-/AAB-Build ist nur über den
  GitHub-Actions-Workflow verifizierbar, nicht lokal.

## Entscheidungen, die bei dir liegen

Details und Empfehlungen stehen in `PLAN.md`, Abschnitt 10.

| ID | Frage | Status |
|---|---|---|
| E1 | React 18 (wie vorgegeben) oder React 19 (Empfehlung)? | offen |
| E2 | Harte 500-ms-Grenze für Experte-Generierung oder Median-Kriterium (Empfehlung)? | offen |
| E3 | 200 Eindeutigkeitsprüfungen pro Grad in jedem CI-Lauf oder 25 + nächtlicher Volllauf (Empfehlung)? | offen |
| E4 | **Blockierend:** Darf ich pro Meilenstein eigene Feature-Branches pushen? | offen |
| E5 | **Blockierend:** Bundle-ID `de.samenschluck.hashi` und App-Name bestätigen (nach Play-Upload unveränderlich). | offen |
| E6 | Eigenes Icon-Design von mir oder lieferst du Grafik? | offen |
| E7 | Screenshot-Vorlagen aus dem Browser-Build — einverstanden? | offen |
| E8 | Daily-Schwierigkeit rotierend (Empfehlung) oder fix? | offen |
