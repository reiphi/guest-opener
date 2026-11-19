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
  welcome: (name: string) => `Herzlich willkommen, ${name}!`,
  enterPin: "Bitte geben Sie Ihren 6-stelligen PIN ein.",
  pinLabel: "PIN",
  submit: "Weiter",
  wrongPin: (left: number) => `Der PIN stimmt leider nicht. Sie haben noch ${left} Versuch(e).`,
  locked: (until: string) => `Zu viele Fehlversuche. Bitte versuchen Sie es ab ${until} noch einmal.`,
  invalidLink: "Dieser Link ist leider ungültig.",
  revoked: "Dieser Zugang wurde deaktiviert.",
  upcoming: (from: string) => `Ihr Zugang ist ab ${from} aktiv. Wir freuen uns auf Sie!`,
  expired: "Ihr Aufenthalt ist beendet. Vielen Dank für Ihren Besuch – wir hoffen, es hat Ihnen bei uns gefallen!",
  validUntil: (until: string) => `Gültig bis ${until}`,
  validForever: "Unbegrenzt gültig",
  pinHint: "Den PIN finden Sie in unserer Nachricht an Sie.",
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
  stepDoor: "Stellen Sie sich vor die Tür und tippen Sie auf den passenden Knopf.",
  stepLocation: "Wenn Ihr Handy nach dem Standort fragt, erlauben Sie ihn bitte.",
  stepLeave: "Beim Gehen ziehen Sie bitte die Tür zu und tippen auf Zusperren.",
  locating: "Standort wird geprüft …",
  opening: "Tür wird geöffnet …",
  openedBuzzer: (name: string) => `Summer ausgelöst – bitte jetzt ${name} aufdrücken.`,
  openedLatch: (name: string) => `${name} ist offen.`,
  unlocked: (name: string) => `${name} ist aufgesperrt – einfach die Klinke drücken.`,
  geoDenied:
    "Ohne Ihren Standort können wir die Tür leider nicht öffnen. Bitte erlauben Sie den Standortzugriff in den Browser-Einstellungen und laden Sie die Seite neu.",
  geoUnavailable: "Ihr Standort konnte nicht ermittelt werden. Bitte gehen Sie kurz ins Freie und versuchen Sie es noch einmal.",
  tooFar: "Sie scheinen nicht vor Ort zu sein. Die Tür lässt sich nur direkt am Haus öffnen.",
  inaccurate: "Ihr Standort ist zu ungenau. Bitte gehen Sie kurz ins Freie und versuchen Sie es noch einmal.",
  doorError: "Die Tür hat leider nicht reagiert. Bitte versuchen Sie es in ein paar Sekunden noch einmal.",
  sessionExpired: "Bitte laden Sie die Seite neu und geben Sie Ihren PIN noch einmal ein.",
  network: "Keine Internetverbindung. Bitte prüfen Sie Ihre mobilen Daten und versuchen Sie es noch einmal.",
  help: "Fragen oder Probleme?",
  callUs: "Rufen Sie uns an",
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
