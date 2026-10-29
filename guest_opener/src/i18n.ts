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
  open: (name: string) => `${name} öffnen`,
  openBuzzerSub: "Summer, dann aufdrücken",
  openLatchSub: "Falle ziehen",
  unlock: (name: string) => `${name} aufsperren`,
  unlockSub: "Klinke drücken",
  lock: (name: string) => `${name} zusperren`,
  lockSub: "Beim Gehen",
  locking: "Tür wird zugesperrt …",
  unlocking: "Tür wird aufgesperrt …",
  lockedDoor: (name: string) => `${name} ist zugesperrt.`,
  stepDoor: "Stell dich vor die Tür und tippe auf den passenden Knopf.",
  stepLocation: "Wenn dein Handy nach dem Standort fragt: bitte erlauben.",
  stepLeave: "Beim Gehen: Tür zuziehen und auf Zusperren tippen.",
  locating: "Standort wird geprüft …",
  opening: "Tür wird geöffnet …",
  openedBuzzer: (name: string) => `Summer ausgelöst – bitte jetzt ${name} aufdrücken.`,
  openedLatch: (name: string) => `${name} ist offen.`,
  unlocked: (name: string) => `${name} ist aufgesperrt – einfach die Klinke drücken.`,
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
  open: (name) => `Open ${name}`,
  openBuzzerSub: "Buzzer, then push",
  openLatchSub: "Pulls the latch",
  unlock: (name) => `Unlock ${name}`,
  unlockSub: "Press the handle",
  lock: (name) => `Lock ${name}`,
  lockSub: "When leaving",
  locking: "Locking door …",
  unlocking: "Unlocking door …",
  lockedDoor: (name) => `${name} is locked.`,
  stepDoor: "Stand at the door and tap the matching button.",
  stepLocation: "If your phone asks for your location, please allow it.",
  stepLeave: "When leaving: pull the door shut and tap Lock.",
  locating: "Checking your location …",
  opening: "Opening door …",
  openedBuzzer: (name) => `Buzzer released – please push ${name} open now.`,
  openedLatch: (name) => `${name} is open.`,
  unlocked: (name) => `${name} is unlocked – just press the handle.`,
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
