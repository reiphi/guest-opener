import type { HomeAssistant } from "./homeassistant";

/**
 * Pushes important events to the host's phone through a Home Assistant notify service
 * (e.g. notify.mobile_app_phils_iphone). Without a configured service nothing is sent.
 */
export class Notifier {
  constructor(
    private readonly ha: HomeAssistant,
    /** "notify.<name>" or empty */
    private readonly service: string,
  ) {}

  get enabled(): boolean {
    return !!this.service && this.ha.configured;
  }

  /** Fire and forget: a failing notification must never block or break a door action. */
  send(title: string, message: string): void {
    if (!this.enabled) return;
    const name = this.service.replace(/^notify\./, "");
    this.ha.callService("notify", name, { title, message }).catch((err) => {
      console.error(`notification via notify.${name} failed:`, err instanceof Error ? err.message : err);
    });
  }
}
