type Bucket = { failures: number; windowStart: number; lockedUntil: number };

/**
 * Locks out password guessing: per client after `perClient` failures, and for everyone after `global`
 * failures, each counted within `windowMs`. The global limit matters because X-Real-IP can be
 * spoofed when the add-on port is reached directly, without the reverse proxy in front.
 * Kept in memory: a restart clears it, which is acceptable for a single small server.
 */
export class LoginThrottle {
  private readonly clients = new Map<string, Bucket>();
  private readonly all: Bucket = { failures: 0, windowStart: 0, lockedUntil: 0 };

  constructor(
    private readonly opts = { perClient: 5, global: 20, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  ) {}

  /** Epoch ms until which logins are refused for this client, or null. */
  lockedUntil(client: string, now = Date.now()): number | null {
    const until = Math.max(this.all.lockedUntil, this.clients.get(client)?.lockedUntil ?? 0);
    return until > now ? until : null;
  }

  /** Records a failed attempt; returns which lock (if any) it triggered. */
  fail(client: string, now = Date.now()): "client" | "global" | null {
    if (this.clients.size > 10_000) this.prune(now);
    let bucket = this.clients.get(client);
    if (!bucket) this.clients.set(client, (bucket = { failures: 0, windowStart: now, lockedUntil: 0 }));
    const clientLocked = this.count(bucket, this.opts.perClient, now);
    const globalLocked = this.count(this.all, this.opts.global, now);
    return globalLocked ? "global" : clientLocked ? "client" : null;
  }

  succeed(client: string) {
    this.clients.delete(client);
  }

  private count(bucket: Bucket, limit: number, now: number): boolean {
    if (now - bucket.windowStart > this.opts.windowMs) {
      bucket.failures = 0;
      bucket.windowStart = now;
    }
    bucket.failures++;
    if (bucket.failures < limit) return false;
    bucket.failures = 0;
    bucket.windowStart = now;
    bucket.lockedUntil = now + this.opts.lockMs;
    return true;
  }

  private prune(now: number) {
    for (const [key, b] of this.clients) {
      if (b.lockedUntil < now && now - b.windowStart > this.opts.windowMs) this.clients.delete(key);
    }
  }
}
