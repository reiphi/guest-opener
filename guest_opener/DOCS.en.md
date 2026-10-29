# Guest Opener

Deutsch: [DOCS.md](https://github.com/reiphi/guest-opener/blob/main/guest_opener/DOCS.md)

Time-limited access for guests. Each person gets a link and a six-digit PIN. On site they use it
to open the front door and the apartment door from their phone. After checkout the access stops
working.

The doors are Home Assistant entities. The add-on does not care which lock or button is behind them.

The guest and admin pages are always dark. German and English follow the phone language, or
`?lang=de` / `?lang=en` on the link.

Home Assistant shows the German file in the Documentation tab. This file is the same guide in English.

## For guests

1. Open the link and enter the PIN. After the sixth digit it continues. The phone remembers the
   login until checkout.
2. At the front door, tap **Open front door**. The phone asks for location once.
3. At the apartment, tap **Open apartment door**.
4. When leaving, close the door and tap **Lock apartment door**. That works without location.

## Installation

Requires Home Assistant with the Supervisor (Home Assistant OS or Supervised).

1. Settings → Add-ons → Add-on store → ⋮ → **Repositories**.
2. Add `https://github.com/reiphi/guest-opener`.
3. Install **Guest Opener** and start it. The image is built on the device.

Without a public repository, copy the `guest_opener/` folder to `/addons/guest_opener/` (without
`node_modules`, `dist` and `.data`) and check for updates in the store. The add-on shows up under
local add-ons.

## Configuration

On the **Configuration** tab set at least these values, then restart the add-on:

- `admin_password`, at least 12 characters
- `property_lat` and `property_lon`, the coordinates of the front door
- `door_house` and `door_apartment`, the entities from Home Assistant

| Option | Meaning |
| --- | --- |
| `property_name` | Heading on the pages. Default: `Ferienwohnung`. |
| `public_url` | Public address, for example `https://door.example.com`. Used in guest links. Empty: the address the admin page was opened with. |
| `timezone` | Time zone for arrival and departure. Default: `Europe/Berlin`. |
| `property_lat`, `property_lon` | Coordinates of the front door. |
| `geofence_radius_m` | How close, in metres, a guest must be to open a door. `0` disables the check. Default: 250. |
| `host_phone` | Number shown to guests as a call button. |
| `admin_password` | Password for `/admin`. At least 12 characters. Changing it signs out every admin session. |
| `door_house` | Front-door entity, for example `switch.front_door`. `mock` simulates the door. |
| `door_house_battery` | Optional. A `sensor.*` in percent, or a `binary_sensor.*` (`on` = low). |
| `door_apartment` | Apartment-door entity, for example `lock.apartment_door`. `mock` simulates the door. |
| `door_apartment_battery` | Optional, same as the front door. |
| `door_apartment_unlock_only` | On when the apartment door has a handle on the outside. "Open" then only unlocks (`lock.unlock`) instead of pulling the latch. |
| `notify_service` | Optional. Push service, for example `notify.mobile_app_my_phone`. |

`mock` does not trigger a real door. Use it to try the admin page before the entities are known.

The add-on does not start if the password is shorter than 12 characters, or if the coordinates are
missing while the location check is on.

### Entities

Add the devices to Home Assistant first and trigger them there once. Then enter the entity id.

| Domain | Open | Lock |
| --- | --- | --- |
| `lock.*` | `lock.open`. With `door_apartment_unlock_only`, `lock.unlock` instead. | `lock.lock` |
| `switch.*` | `switch.turn_on` | – |
| `button.*` | `button.press` | – |
| `script.*` | `script.turn_on` | – |

**Lock apartment door** exists only when the apartment door is a `lock.*` or `mock`.
A lock reaches Home Assistant through Matter, the manufacturer's integration, or MQTT.

Battery: a `sensor.*` with a percentage, or a `binary_sensor.*` where `on` means low. The admin
page warns from 20 % down.

### Notifications

`notify_service` is a service from Developer tools → Actions whose name starts with `notify.`.
The usual one is the Home Assistant app on a phone, `notify.mobile_app_<name>`.

A push is sent when

- a guest opens a door for the first time,
- someone tries to open a door from outside the radius,
- a link is locked after five wrong PINs,
- the admin login is locked after failed attempts,
- a door does not respond.

### First test on the local network

In the add-on's network configuration, set port `8787` and open
`http://<home-assistant>:8787/admin`. Use the test buttons on the device cards.
Clear the port afterwards. Guests should not arrive through that address.

## From outside

Guest Opener listens only on Home Assistant's internal network, as `local-guest-opener` on port
8787. From outside, the way in is a reverse proxy on the same machine. Home Assistant itself
(port 8123) stays on the local network.

That needs a domain name and a connection where a port forward arrives. This path does not work
behind CGNAT or DS-Lite.

1. At the DNS provider, create an A and an AAAA record with dynamic DNS for the hostname, for
   example `door.example.com`. The provider supplies the credentials.
2. On the router, forward only TCP 80 and TCP 443 to the Home Assistant machine. Port 80 is for
   the certificate. Do not forward 8123, 8787 or the proxy's own admin port. For IPv6, allow only
   443 to that machine in the firewall.
3. Point the proxy at `http://local-guest-opener:8787` for that hostname and obtain a certificate.
   Protect `/admin` with an extra password. Paths under `/g/` stay reachable without it.
4. Set the add-on's `public_url` to `https://door.example.com`.

### Example: Nginx Proxy Manager

Install the add-on from `https://github.com/hassio-addons/repository`.
Its UI is `http://<home-assistant>:81`. The first start prints the user and password in the log.
Change both immediately. Do not forward port 81 on the router.

Under **Access Lists**, create a list `Admin` with its own user. No IP rule.

Under **Hosts → Proxy Hosts**, create a host:

| Field | Value |
| --- | --- |
| Domain Names | `door.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | `local-guest-opener` |
| Forward Port | `8787` |
| Block Common Exploits | on |
| Websockets Support | off |

Under **Custom Locations**, add a location `/admin` with the same target and the access list
`Admin`. Under **SSL**, request a new certificate and turn on Force SSL.

`/admin` then asks for the proxy password first and the Guest Opener password second.
The proxy must set `X-Real-IP` and `X-Forwarded-Proto`. Nginx Proxy Manager does.
Without `X-Real-IP`, every login through the proxy counts as the same client, and the login lock
hits everyone at once.

Check from mobile data, not from the local Wi-Fi: `https://door.example.com/admin` asks for the
proxy password. A guest link opens without that password.

## Day to day

1. Open `/admin`. Under **New stay**, enter the name, arrival and departure.
2. **Copy message** and send it to the guest. It contains the link, the PIN and a short guide.
   Under **⋯** there is the same message in English, the link only, a new PIN, revoke and delete.
3. A new PIN signs out existing sessions for that guest.

**Admin users** are access entries without an end date, for example for cleaning. The location
check applies to them too.

The test buttons on the devices fire immediately, without a location check, and ask first.
The **log** shows who triggered which door and when. Entries older than a year are deleted.

## Security

A guest is protected by the link and the PIN together, and by both being valid only between
arrival and departure. The link contains 192 random bits. Five wrong PINs lock it for 15 minutes.

The location check stops accidents and casual forwarding of the link. The coordinates come from
the guest's phone. Anyone who has the link and the PIN and builds the request themselves can fake
them. Send the message only to the guest, issue a new PIN or revoke the access if something looks
wrong, and turn on `notify_service`.

The admin page has its own password. Five failures from one address, or twenty in total, lock
login for 15 minutes. The cookie lasts 30 days, and is `HttpOnly` and `SameSite=Strict`. Changing
the password signs out every admin session. In front of that, the reverse proxy should protect
`/admin` with a password of its own.

Pages send a strict Content-Security-Policy, forbid embedding, force HTTPS behind a TLS proxy and
accept at most 16 KB.

The add-on talks to Home Assistant only through the Supervisor API (`homeassistant_api: true`).
It switches the two configured entities and, if set, the notification service.

## Data and outages

The SQLite file and the generated session secret live in `/data` and are therefore in every
Home Assistant backup. Copy backups off the machine automatically.

With no power or no internet on site, nothing works from outside. A key safe with a spare key is
the fallback. Share that code only in an emergency.

After an update of Home Assistant or of this add-on, press the test buttons once.

## Liability

Guest Opener switches physical doors. Whether a door opens depends on the lock, on Home Assistant
and on the network. The location check does not stop someone who has the link and the PIN and
builds the request themselves.

You decide who receives a link, how access from outside is protected, and what still works when
power or internet fails. A key safe with a spare key remains the fallback.

The software is published under the [MIT license](https://github.com/reiphi/guest-opener/blob/main/LICENSE)
and provided without warranty. The license text disclaims liability to the extent the law allows.

## Development and license

Source, tests and how to run it on your own machine are in the
[repository README](https://github.com/reiphi/guest-opener).
Bugs and wishes belong in the issues there.
