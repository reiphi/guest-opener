# Guest Opener

English: [DOCS.en.md](https://github.com/reiphi/guest-opener/blob/main/guest_opener/DOCS.en.md)

Zeitlich begrenzter Zugang für Gäste. Jede Person bekommt einen Link und einen sechsstelligen PIN.
Damit öffnet sie vor Ort die Haustür und die Wohnungstür vom Handy aus. Nach der Abreise gilt der
Zugang nicht mehr.

Die Türen sind Home-Assistant-Entitäten. Welches Schloss oder welcher Taster dahintersteckt, ist
dem Add-on egal.

Gäste- und Verwaltungsseite sind fest dunkel. Deutsch und Englisch folgen der Handysprache oder
`?lang=de` / `?lang=en` am Link.

## Für Gäste

1. Link öffnen und den PIN eingeben. Nach der sechsten Ziffer geht es weiter. Das Handy merkt sich
   die Anmeldung bis zur Abreise.
2. An der Tür auf den passenden Knopf tippen. Die Knöpfe hängen an der Konfiguration: nur die
   aktiven Türen, und je Tür Öffnen, Aufsperren und Zusperren. Öffnen und Aufsperren fragen nach
   dem Standort. Zusperren nicht.

## Installation

Voraussetzung ist Home Assistant mit Supervisor (Home Assistant OS oder Supervised).

1. Einstellungen → Add-ons → Add-on-Store → ⋮ → **Repositories**.
2. `https://github.com/reiphi/guest-opener` eintragen.
3. **Guest Opener** installieren und starten. Das Image wird auf dem Gerät gebaut.

Ohne öffentliches Repository denselben Ordner `guest_opener/` nach `/addons/guest_opener/` kopieren
(ohne `node_modules`, `dist` und `.data`) und im Store nach Updates suchen. Das Add-on erscheint
unter den lokalen Add-ons.

## Konfiguration

Im Reiter **Konfiguration** mindestens diese Werte setzen, dann das Add-on neu starten:

- `admin_password`, mindestens 12 Zeichen
- `property_lat` und `property_lon`, die Koordinaten der Haustür
- mindestens eine Tür: `door_house` oder `door_apartment`

| Option | Bedeutung |
| --- | --- |
| `property_name` | Überschrift auf den Seiten. Standard: `Ferienwohnung`. |
| `public_url` | Öffentliche Adresse, z. B. `https://tuer.example.de`. Steht in den Gäste-Links. Leer: die Adresse, unter der die Verwaltung gerade geöffnet ist. |
| `timezone` | Zeitzone für An- und Abreise. Standard: `Europe/Berlin`. |
| `property_lat`, `property_lon` | Koordinaten der Haustür. |
| `geofence_radius_m` | So nah, in Metern, muss ein Gast sein, um zu öffnen. `0` schaltet die Prüfung ab. Standard: 250. |
| `host_phone` | Nummer, die Gästen als Anruf-Schaltfläche angezeigt wird. |
| `admin_password` | Passwort für `/admin`. Mindestens 12 Zeichen. Eine Änderung meldet alle Verwaltungen ab. |
| `door_house`, `door_apartment` | `off` blendet die Tür aus. `mock` simuliert sie. Sonst die Entität, z. B. `switch.haustuer` oder `lock.wohnungstuer`. Mindestens eine Tür muss an sein. |
| `door_house_name`, `door_apartment_name` | Bezeichnung auf den Knöpfen und in der Gästenachricht. Leer: `Haustür` bzw. `Wohnungstür`. |
| `door_house_mode`, `door_apartment_mode` | `open` nur öffnen. `open_and_lock` Falle ziehen und zusperren. `unlock_and_lock` aufsperren und zusperren. Die letzten beiden brauchen `lock.*` oder `mock`. |
| `door_house_battery`, `door_apartment_battery` | Optional. `sensor.*` in Prozent oder `binary_sensor.*` (`on` = schwach). |
| `notify_service` | Optional. Dienst für Push-Nachrichten, z. B. `notify.mobile_app_mein_handy`. |

`mock` löst keine echte Tür aus. Damit lässt sich die Verwaltung ausprobieren, bevor die Entitäten feststehen.

Das Add-on startet nicht, wenn das Passwort kürzer als 12 Zeichen ist, die Koordinaten fehlen,
während die Standortprüfung an ist, beide Türen auf `off` stehen, oder eine Betriebsart ein Schloss
verlangt, die Entität aber keines ist.

### Entitäten

Die Geräte zuerst in Home Assistant einbinden und dort einmal selbst auslösen. Dann die
Entitäts-ID eintragen.

| Domain | `open` | `unlock_and_lock` | `open_and_lock` |
| --- | --- | --- | --- |
| `lock.*` | `lock.open` | `lock.unlock` und `lock.lock` | `lock.open` und `lock.lock` |
| `switch.*` | `switch.turn_on` | – | – |
| `button.*` | `button.press` | – | – |
| `script.*` | `script.turn_on` | – | – |

`open_and_lock` und `unlock_and_lock` gibt es nur bei `lock.*` und bei `mock`.
Wer bisher `door_apartment_unlock_only` an hatte und die neue Betriebsart noch nicht setzt, bleibt
auf `unlock_and_lock`. Sobald `door_apartment_mode` gesetzt ist, gilt nur noch diese.
Ein Schloss kommt je nach Gerät über Matter, die Integration des Herstellers oder MQTT in
Home Assistant.

Batterie: ein `sensor.*` mit einem Prozentwert, oder ein `binary_sensor.*`, bei dem `on` „schwach“
bedeutet. Ab 20 % warnt die Verwaltung.

### Benachrichtigungen

`notify_service` ist ein Dienst aus Entwicklerwerkzeuge → Aktionen, der mit `notify.` beginnt.
Üblich ist die Home-Assistant-App auf dem Handy, `notify.mobile_app_<name>`.

Dann kommt eine Push-Nachricht, wenn

- ein Gast zum ersten Mal eine Tür öffnet,
- jemand eine Tür von außerhalb des Radius öffnen will,
- ein Link nach fünf falschen PINs gesperrt wird,
- der Admin-Login nach Fehlversuchen gesperrt wird,
- eine Tür nicht reagiert.

### Erster Test im Heimnetz

In der Netzwerk-Konfiguration des Add-ons den Port `8787` eintragen und
`http://<home-assistant>:8787/admin` öffnen. Die Testknöpfe in der Geräte-Karte auslösen.
Den Port danach wieder leeren. Gäste sollen nicht über diese Adresse kommen.

## Von außen

Guest Opener lauscht nur im internen Netz von Home Assistant, unter dem Namen `local-guest-opener`
auf Port 8787. Von außen führt der Weg über einen Reverse Proxy auf demselben Rechner.
Home Assistant selbst (Port 8123) bleibt im lokalen Netz.

Dafür braucht es eine eigene Domain und einen Anschluss, bei dem eine Portfreigabe ankommt.
Hinter CGNAT oder DS-Lite funktioniert dieser Weg nicht.

1. Beim DNS-Anbieter für den Hostnamen, z. B. `tuer.example.de`, einen A- und einen AAAA-Eintrag
   mit dynamischem DNS anlegen. Die Zugangsdaten nennt der Anbieter.
2. Im Router nur TCP 80 und TCP 443 an den Home-Assistant-Rechner weiterleiten. 80 braucht das
   Zertifikat. 8123, 8787 und die Verwaltung des Proxys nicht weiterleiten. Bei IPv6 in der
   Firewall ebenfalls nur 443 zu diesem Rechner erlauben.
3. Den Proxy so einrichten, dass er `tuer.example.de` an `http://local-guest-opener:8787` gibt
   und ein Zertifikat holt. `/admin` zusätzlich mit einem eigenen Passwort schützen.
   Die Seiten unter `/g/` bleiben ohne dieses Passwort erreichbar.
4. Im Add-on `public_url` auf `https://tuer.example.de` setzen.

### Beispiel: Nginx Proxy Manager

Das Add-on aus dem Repository `https://github.com/hassio-addons/repository` installieren.
Die Oberfläche ist `http://<home-assistant>:81`. Benutzer und Passwort stehen beim ersten Start
im Protokoll. Beides sofort ändern. Port 81 nicht am Router freigeben.

Unter **Access Lists** eine Liste `Verwaltung` mit einem eigenen Benutzer anlegen. Keine IP-Regel.

Unter **Hosts → Proxy Hosts** einen Host anlegen:

| Feld | Wert |
| --- | --- |
| Domain Names | `tuer.example.de` |
| Scheme | `http` |
| Forward Hostname / IP | `local-guest-opener` |
| Forward Port | `8787` |
| Block Common Exploits | an |
| Websockets Support | aus |

Unter **Custom Locations** eine Location `/admin` mit demselben Ziel und der Access List
`Verwaltung`. Unter **SSL** ein neues Zertifikat anfordern und Force SSL einschalten.

`/admin` fragt dann zuerst nach dem Proxy-Passwort und danach nach dem Passwort des Guest Openers.
Der Proxy muss `X-Real-IP` und `X-Forwarded-Proto` setzen. Nginx Proxy Manager tut das.
Ohne `X-Real-IP` gelten alle Anmeldungen über den Proxy als derselbe Client, und die Login-Sperre
trifft dann alle auf einmal.

Vom Mobilfunk aus prüfen, nicht aus dem lokalen WLAN: `https://tuer.example.de/admin` verlangt das
Proxy-Passwort. Ein Gäste-Link öffnet sich ohne dieses Passwort.

## Alltag

1. `/admin` öffnen. Unter **Neuer Aufenthalt** Name, Anreise und Abreise eintragen.
2. **Nachricht kopieren** und an den Gast schicken. Sie enthält Link, PIN und eine kurze Anleitung.
   Unter **⋯** gibt es dieselbe Nachricht auf Englisch, nur den Link, einen neuen PIN, Widerrufen
   und Löschen.
3. Ein neuer PIN macht bestehende Anmeldungen dieses Gasts ungültig.

**Admin-Nutzer** sind Zugänge ohne Ablaufdatum, zum Beispiel für die Reinigung. Die Standortprüfung
gilt auch für sie.

Die Testknöpfe bei den Geräten lösen sofort aus, ohne Standortprüfung, und fragen vorher nach.
Im **Protokoll** steht, wer wann welche Tür ausgelöst hat. Einträge, die älter als ein Jahr sind,
werden gelöscht.

## Sicherheit

Der Schutz eines Gasts ist die Kombination aus Link und PIN, und dass beides nur zwischen Anreise
und Abreise gilt. Der Link enthält 192 zufällige Bits. Fünf falsche PINs sperren ihn für
15 Minuten.

Die Standortprüfung ist ein Schutz gegen Versehen und gegen einfaches Weitergeben des Links.
Die Koordinaten kommen vom Handy des Gasts. Wer Link und PIN hat und die Anfrage selbst baut,
kann sie fälschen. Deshalb die Nachricht nur an den Gast schicken, bei Verdacht einen neuen PIN
erzeugen oder den Zugang widerrufen, und `notify_service` einschalten.

Die Verwaltung hat ein eigenes Passwort. Fünf Fehlversuche von einer Adresse, oder zwanzig
insgesamt, sperren die Anmeldung für 15 Minuten. Das Cookie gilt 30 Tage, ist `HttpOnly` und
`SameSite=Strict`. Eine Änderung des Passworts meldet alle Verwaltungen ab. Davor soll der
Reverse Proxy `/admin` noch einmal mit einem eigenen Passwort schützen.

Seiten senden eine strikte Content-Security-Policy, verbieten Einbetten, erzwingen HTTPS hinter
einem TLS-Proxy und nehmen höchstens 16 KB entgegen.

Gegen Home Assistant spricht das Add-on nur über die Supervisor-API (`homeassistant_api: true`).
Es schaltet die beiden eingetragenen Entitäten und, wenn gesetzt, den Benachrichtigungsdienst.

## Daten und Ausfall

SQLite-Datei und das automatisch erzeugte Session-Secret liegen in `/data` und damit in jedem
Home-Assistant-Backup. Backups automatisch wegkopieren.

Ohne Strom oder ohne Internet vor Ort geht von außen nichts mehr. Ein Schlüsselsafe mit
Ersatzschlüssel bleibt der Notfallweg. Den Code nur im Notfall weitergeben.

Nach einem Update von Home Assistant oder diesem Add-on einmal die Testknöpfe drücken.

## Haftung

Guest Opener schaltet physische Türen. Ob eine Tür aufgeht, hängt vom Schloss, von Home Assistant
und vom Netz ab. Die Standortprüfung hält niemanden auf, der Link und PIN hat und die Anfrage
selbst baut.

Du entscheidest, wer einen Link bekommt, wie der Zugang von außen abgesichert ist, und was geht,
wenn Strom oder Internet ausfallen. Ein Schlüsselsafe mit Ersatzschlüssel bleibt der Notfallweg.

Die Software steht unter der [MIT-Lizenz](https://github.com/reiphi/guest-opener/blob/main/LICENSE)
und wird ohne Gewährleistung bereitgestellt. Der Lizenztext schließt die Haftung aus, soweit das
gesetzlich zulässig ist.

## Entwicklung und Lizenz

Quelltext, Tests und der Start auf dem eigenen Rechner stehen in der
[README des Repositorys](https://github.com/reiphi/guest-opener).
Fehler und Wünsche gehören in die Issues dort.
