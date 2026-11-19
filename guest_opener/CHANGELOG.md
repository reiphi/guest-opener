# Changelog

## 1.3.2

- Sicherheitsupdate: `hono` 4.13.19 und `@hono/node-server` 2.1.9. Behoben sind unter anderem ein
  Backslash im Pfad, mit dem sich eine `/admin`-Sperre am Reverse Proxy umgehen ließ
  (GHSA-jpvv-r467-5p4w), und Wildcard-Middleware, die der Router überspringen konnte
  (GHSA-h7mg-cq63-vhpq).

## 1.3.1

- Eine ungültige Zeitzone verhindert den Start mit einer klaren Meldung. Bisher startete das
  Add-on und jede Seite brach mit einem Fehler ab.
- Die Gästenachricht nennt die Unterkunft ohne festen Artikel: „für „Haus Alpenblick““ statt
  „für die Haus Alpenblick“.
- Formulare von einer anderen Subdomain der eigenen Domain werden abgelehnt (bisher nur von
  fremden Domains).
- Mehrere gleichzeitige Anfragen lösen eine Tür nur einmal aus. Schlägt das Öffnen fehl, kann der
  Gast sofort erneut tippen.
- Die Sperre nach zwanzig falschen Admin-Passwörtern gilt nicht mehr für Geräte, die sich schon
  einmal angemeldet haben. Absichtliche Fehlversuche können die Verwaltung so nicht mehr blockieren.
- Aufenthalte werden ein Jahr nach der Abreise gelöscht, wie das Protokoll.
- Meldungen in der Verwaltung kommen nicht mehr aus der Adresse (`?msg=`), sondern aus einem
  kurzlebigen Cookie. Aktionen auf einen gelöschten Zugang melden das.
- Unmögliche Daten wie der 30. Februar werden abgelehnt.
- Watchdog: Home Assistant startet das Add-on neu, wenn es nicht mehr antwortet.

## 1.3.0

- Jede Tür kann aus sein (`off`), simuliert (`mock`) oder eine Home-Assistant-Entität.
- Pro Tür eine Bezeichnung und eine Betriebsart: nur öffnen, Falle ziehen und zusperren,
  oder aufsperren und zusperren.
- Die Gästenachricht nennt die eingestellten Türen und Knöpfe.

## 1.2.3

- Dokumentation an den Aufbau eines Home-Assistant-Add-on-Repositories angepasst
  (`README.md`, `DOCS.md`, `CHANGELOG.md` im Add-on-Ordner).
- Dieselbe Anleitung auf Englisch (`DOCS.en.md`). Home Assistant zeigt im Add-on nur die deutsche
  Datei an.
- Hinweis zur Haftung, mit Verweis auf die MIT-Lizenz.
- Keine Änderung am Verhalten.

## 1.2.2

- Der voreingestellte Name der Unterkunft ist ein Platzhalter.

## 1.2.1

- Erreichbarkeit über einen Reverse Proxy statt über einen Cloudflare-Tunnel.
- Die Login-Sperre verwendet `X-Real-IP`. Ein mitgeschicktes `CF-Connecting-IP` wird ignoriert.

## 1.2.0

- Wohnungstür kann nur aufsperren, statt die Falle zu ziehen.
- Gästenachricht ohne Stockwerksangabe.

## 1.1.0

- Festes dunkles Design.
- Sperre gegen das Durchprobieren des Admin-Passworts.
- Push-Benachrichtigungen über einen Home-Assistant-Dienst `notify.*`.
- Strikte Content-Security-Policy. Styles und Skripte kommen aus eigenen Dateien.

## 1.0.0

- Erstes Add-on: Gästelinks mit PIN, Standortprüfung, Haus- und Wohnungstür, Admin-Nutzer,
  Batteriewarnung, SQLite.
