# Guest Opener

Home-Assistant-Add-on: Gäste öffnen mit Link + sechsstelligem PIN im Zeitfenster ihres Aufenthalts
Haus- und Wohnungstür vom Handy aus. Repository im Aufbau eines HA-Add-on-Repositories:
`repository.yaml` im Wurzelverzeichnis, das Add-on in `guest_opener/`.

## Befehle

Alle in `guest_opener/` ausführen (Node 24, wegen `node:sqlite`):

```
npm run dev        # tsx watch mit .env (Vorlage: .env.example), Türen als mock
npm test           # node:test über test/*.test.ts
npm run typecheck  # tsc --noEmit
npm run build      # esbuild → dist/server.mjs (ein einziges Bundle)
```

Vor jedem Commit `npm test` und `npm run typecheck` laufen lassen.

## Aufbau (`guest_opener/src/`)

- `server.ts` – Einstieg: Config laden, Store, HA-Client, Doors, Notifier, HTTP-Server auf 8787
- `app.ts` – alle Routen (Hono): Gast `/g/:token`, PIN, `/g/:token/door` (JSON), Verwaltung `/admin/*`,
  Sicherheits-Header, CSP, Body-Limit, Login-Sperre
- `config.ts` – liest `/data/options.json` (im Add-on) oder Umgebungsvariablen (lokal) und prüft alles in
  `buildConfig`; ungültige Werte führen zum Abbruch mit Fehlerliste
- `doors.ts` – Türen `house`/`apartment`, Betriebsarten `open | open_and_lock | unlock_and_lock`,
  Zuordnung Entitätsdomäne → HA-Dienst, Batteriestatus; Entität `off` blendet aus, `mock` simuliert
- `store.ts` – SQLite (`node:sqlite`): Tabellen `stays` (Gäste und dauerhafte Admin-Nutzer, `role`) und `access_log`
- `views.ts` – serverseitig erzeugtes HTML als Template-Strings; jede Ausgabe von Daten über `esc()`
- `assets.ts` – CSS und Browser-JS als Strings, `ASSET_VERSION` als Hash für Cache-Busting
- `i18n.ts` – Texte der Gästeseite Deutsch/Englisch; die Verwaltung ist nur Deutsch
- `geo.ts`, `time.ts`, `crypto.ts`, `throttle.ts`, `notify.ts`, `homeassistant.ts` – kleine Hilfsmodule

Tests nutzen `test/helpers.ts` (`testConfig`, `setup` mit In-Memory-Store, Cookie-Jar und gesammelten
Benachrichtigungen) und rufen die App direkt über `app.request` auf.

## Neue Add-on-Option hinzufügen

Eine Option muss an allen diesen Stellen nachgezogen werden:

1. `guest_opener/config.yaml` – `options` (Standardwert) und `schema`
2. `src/config.ts` – Typ `Options`, `optionsFromEnv` (Großbuchstaben-Variable), Prüfung in `buildConfig`, Typ `Config`
3. `.env.example`
4. `translations/de.yaml` und `translations/en.yaml`
5. `DOCS.md` und `DOCS.en.md`, bei Bedarf `README.md`/`README.en.md`
6. Tests

## Versionen

Bei einer Änderung am Verhalten: Version in `guest_opener/config.yaml` **und** `guest_opener/package.json`
erhöhen und einen Eintrag in `guest_opener/CHANGELOG.md` ergänzen (Deutsch). Home Assistant erkennt Updates
nur über die Version in `config.yaml`.

## Konventionen

- Code-Kommentare und Fehlermeldungen in `buildConfig` auf Englisch; Oberfläche, Benachrichtigungen,
  Dokumentation, Changelog und Commit-Texte auf Deutsch.
- Commit-Texte: ein Satz im Imperativ, z. B. „Jede Tür einzeln ausblendbar machen, mit Name und Betriebsart.“
- Keine echten Daten ins Repository: Name der Unterkunft, Koordinaten, Telefonnummer, öffentliche Adresse und
  Entitäts-IDs gehören nur in die Add-on-Konfiguration bzw. `.env`. Beispiele bleiben Platzhalter.
- Keine Inline-Skripte oder -Styles (CSP `script-src 'self'`, `style-src 'self'`); neues JS/CSS nach `assets.ts`.
- Möglichst keine neuen Abhängigkeiten; das Laufzeit-Image enthält nur das Bundle.
- Zeilenenden LF (`.gitattributes`).

## Sicherheit

Der Schutz ist Link + PIN im Zeitfenster. Die Standortprüfung verhindert nur Versehen, sie lässt sich
fälschen. Nicht aufweichen:

- Gast-Session-Cookie = HMAC über Token, PIN und `valid_until` → neuer PIN meldet alle Geräte ab.
- Admin-Cookie = HMAC über Passwort und Ablauf → Passwortänderung meldet alle ab.
- PIN-Sperre pro Link (5 Versuche, 15 min), Admin-Login-Sperre pro Adresse und global.
- Die Login-Sperre verwendet `X-Real-IP` (vom Reverse Proxy gesetzt); `CF-Connecting-IP` wird bewusst ignoriert.
- POST mit `Sec-Fetch-Site: cross-site` wird abgelehnt; Admin-Cookie `SameSite=Strict`.
- Zusperren (`lock`) überspringt die Standortprüfung, Öffnen und Aufsperren nie.
