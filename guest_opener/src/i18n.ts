export type Lang = "de" | "en";

export function isLang(value: unknown): value is Lang {
  return value === "de" || value === "en";
}

export function pickLang(acceptLanguage: string | undefined, override: string | undefined): Lang {
  if (isLang(override)) return override;
  return (acceptLanguage ?? "").trim().toLowerCase().startsWith("de") ? "de" : "en";
}

const de = {
  locale: "de-DE",
  welcome: (name: string) => `Willkommen, ${name}!`,
  enterPin: "Bitte gib deinen 6-stelligen PIN ein.",
  pinLabel: "PIN",
  submit: "Weiter",
  wrongPin: (left: number) => `Falscher PIN. Noch ${left} Versuch(e).`,
  locked: (until: string) => `Zu viele Fehlversuche. Bitte versuche es ab ${until} erneut.`,
  invalidLink: "Dieser Link ist ungültig.",
  revoked: "Dieser Zugang wurde deaktiviert.",
  upcoming: (from: string) => `Dein Zugang ist ab ${from} aktiv.`,
  expired: "Dein Aufenthalt ist beendet. Wir hoffen, es hat dir gefallen!",
  validUntil: (until: string) => `Gültig bis ${until}`,
  validForever: "Unbegrenzt gültig",
  pinHint: "Den PIN findest du in unserer Nachricht.",
  openHouse: "Haustür öffnen",
  openHouseSub: "Eingang zum Haus",
  openApartment: "Wohnungstür öffnen",
  openApartmentSub: "Deine Ferienwohnung",
  lockApartment: "Wohnungstür zusperren",
  lockApartmentSub: "Beim Gehen",
  locking: "Tür wird zugesperrt …",
  lockedApartment: "Wohnungstür ist zugesperrt.",
  stepDoor: "Stell dich vor die Tür und tippe auf den passenden Knopf.",
  stepLocation: "Wenn dein Handy nach dem Standort fragt: bitte erlauben.",
  stepLeave: "Beim Gehen: Tür zuziehen und „Wohnungstür zusperren“ tippen.",
  locating: "Standort wird geprüft …",
  opening: "Tür wird geöffnet …",
  openedHouse: "Summer ausgelöst – bitte jetzt die Haustür aufdrücken.",
  openedApartment: "Wohnungstür ist offen.",
  unlockedApartment: "Wohnungstür ist aufgesperrt – einfach die Klinke drücken.",
  geoDenied:
    "Ohne Standort können wir die Tür nicht öffnen. Bitte erlaube den Standortzugriff in den Browser-Einstellungen und lade die Seite neu.",
  geoUnavailable: "Standort konnte nicht ermittelt werden. Bitte kurz ins Freie gehen und erneut versuchen.",
  tooFar: "Du scheinst nicht vor Ort zu sein. Die Tür lässt sich nur direkt am Haus öffnen.",
  inaccurate: "Dein Standort ist zu ungenau. Bitte kurz ins Freie gehen und erneut versuchen.",
  doorError: "Die Tür hat nicht reagiert. Bitte in ein paar Sekunden erneut versuchen.",
  sessionExpired: "Bitte lade die Seite neu und gib deinen PIN erneut ein.",
  network: "Keine Internetverbindung. Bitte mobile Daten prüfen und erneut versuchen.",
  help: "Probleme?",
  callUs: "Ruf uns an",
};

const en: typeof de = {
  locale: "en-GB",
  welcome: (name) => `Welcome, ${name}!`,
  enterPin: "Please enter your 6-digit PIN.",
  pinLabel: "PIN",
  submit: "Continue",
  wrongPin: (left) => `Wrong PIN. ${left} attempt(s) left.`,
  locked: (until) => `Too many failed attempts. Please try again after ${until}.`,
  invalidLink: "This link is not valid.",
  revoked: "This access has been deactivated.",
  upcoming: (from) => `Your access starts on ${from}.`,
  expired: "Your stay has ended. We hope you enjoyed it!",
  validUntil: (until) => `Valid until ${until}`,
  validForever: "No expiry",
  pinHint: "You'll find the PIN in our message.",
  openHouse: "Open front door",
  openHouseSub: "Building entrance",
  openApartment: "Open apartment door",
  openApartmentSub: "Your holiday apartment",
  lockApartment: "Lock apartment door",
  lockApartmentSub: "When leaving",
  locking: "Locking door …",
  lockedApartment: "The apartment door is locked.",
  stepDoor: "Stand at the door and tap the matching button.",
  stepLocation: "If your phone asks for your location, please allow it.",
  stepLeave: "When leaving: pull the door shut and tap “Lock apartment door”.",
  locating: "Checking your location …",
  opening: "Opening door …",
  openedHouse: "Buzzer released – please push the front door open now.",
  openedApartment: "The apartment door is open.",
  unlockedApartment: "The apartment door is unlocked – just press the handle.",
  geoDenied:
    "We cannot open the door without your location. Please allow location access in your browser settings and reload the page.",
  geoUnavailable: "Your location could not be determined. Please step outside and try again.",
  tooFar: "You don't seem to be at the property. The door can only be opened on site.",
  inaccurate: "Your location is too inaccurate. Please step outside and try again.",
  doorError: "The door did not respond. Please try again in a few seconds.",
  sessionExpired: "Please reload the page and enter your PIN again.",
  network: "No internet connection. Please check your mobile data and try again.",
  help: "Any problems?",
  callUs: "Call us",
};

export const texts = { de, en };
export type Texts = typeof de;
