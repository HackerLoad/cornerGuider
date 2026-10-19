/** Begrenzt Anfragen pro Minute (gleitendes Fenster). Wartet, statt zu scheitern. */
export class RateLimiter {
  private stamps: number[] = [];

  constructor(
    private readonly maxPerMinute: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async acquire(): Promise<void> {
    const max = Math.max(1, Math.floor(this.maxPerMinute));
    for (;;) {
      const t = this.now();
      this.stamps = this.stamps.filter((s) => t - s < 60_000);
      if (this.stamps.length < max) {
        this.stamps.push(t);
        return;
      }
      await this.sleep(Math.max(50, 60_000 - (t - this.stamps[0]!)));
    }
  }
}
