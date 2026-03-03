export interface LimitNginMemoryAlgorithm<T> {
  shouldBlock(key: string): boolean;
  getState(key: string): T | undefined;
  getRemaining(key: string): number;
  getResetMs(key: string): number;
  cleanUp(): void;
}

export type TokenBucketEntry = {
  tokens: number;
  lastRefillTs: number;
};
export type SlidingCounterEntry = {
  currentWindowStart: number;
  currentCount: number;
  previousCount: number;
};

export class MemTokenBucket implements LimitNginMemoryAlgorithm<TokenBucketEntry> {
  private store = new Map<string, TokenBucketEntry>();
  private capacity: number;
  private intervalMs: number;
  private refillRatePerMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(capacity: number, intervalInMs: number) {
    this.capacity = capacity;
    this.intervalMs = intervalInMs;
    this.refillRatePerMs = this.capacity / this.intervalMs;

    this.cleanupTimer = setInterval(
      () => {
        this.cleanUp();
      },
      Math.max(this.intervalMs, 60_000),
    );

    this.cleanupTimer.unref?.();
  }

  getState(key: string) {
    return this.store.get(key);
  }

  shouldBlock(key: string): boolean {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, {
        tokens: this.capacity - 1,
        lastRefillTs: now,
      });

      return false;
    }

    // Refill
    const elapsedMs = now - entry.lastRefillTs;
    const refillAmount = elapsedMs * this.refillRatePerMs;

    entry.tokens = Math.min(this.capacity, entry.tokens + refillAmount);

    entry.lastRefillTs = now;

    if (entry.tokens < 1) {
      return true;
    }

    entry.tokens -= 1;
    return false;
  }

  getRemaining(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return this.capacity;

    return Math.floor(entry.tokens);
  }

  getResetMs(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;

    if (entry.tokens >= this.capacity) return 0;

    const missingTokens = this.capacity - entry.tokens;

    // time required to refill missing tokens
    return Math.ceil(missingTokens / this.refillRatePerMs);
  }

  cleanUp(): void {
    const now = Date.now();

    for (const [key,entry] of this.store) {

      const elapsed = now - entry.lastRefillTs;

      // Fully refilled AND inactive for at least one interval
      const fullyRefilled =
        entry.tokens + elapsed * this.refillRatePerMs >= this.capacity;

      if (fullyRefilled && elapsed >= this.intervalMs) {
        this.store.delete(key);
      }
    }
  }
}

export class MemSlidingWindowCounter implements LimitNginMemoryAlgorithm<SlidingCounterEntry> {
  private store = new Map<string, SlidingCounterEntry>();
  private capacity: number;
  private intervalMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(allowedNoOfRequests: number, intervalInMs: number) {
    this.capacity = allowedNoOfRequests;
    this.intervalMs = intervalInMs;
    this.cleanupTimer = setInterval(() => {
      this.cleanUp();
    }, Math.max(this.intervalMs, 60_000));

    this.cleanupTimer.unref?.();
  }

  getState(key: string) {
    return this.store.get(key);
  }

  shouldBlock(key: string): boolean {
    const now = Date.now();

    const windowIndex = Math.floor(now / this.intervalMs);
    const windowStart = windowIndex * this.intervalMs;

     let entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, {
        currentWindowStart: windowStart,
        currentCount: 1,
        previousCount: 0,
      });
      return false;
    }

    // Window changed
    if (entry.currentWindowStart !== windowStart) {
      const windowsPassed =
        (windowStart - entry.currentWindowStart) / this.intervalMs;

      if (windowsPassed >= 2) {
        // Completely reset
        entry.previousCount = 0;
      } else {
        // Shift
        entry.previousCount = entry.currentCount;
      }

      entry.currentCount = 0;
      entry.currentWindowStart = windowStart;
    }

    const elapsedInWindow = now - entry.currentWindowStart;
    const weight = 1 - elapsedInWindow / this.intervalMs;

    const estimated = entry.currentCount + entry.previousCount * weight;

    if (estimated + 1 > this.capacity) {
      return true;
    }

    entry.currentCount += 1;
    return false;
  }

  getRemaining(key: string): number {
     const entry = this.store.get(key);
    if (!entry) return this.capacity;

    const now = Date.now();
    const elapsed = now - entry.currentWindowStart;

    const weight = 1 - elapsed / this.intervalMs;

    const estimated = entry.currentCount + entry.previousCount * weight;

    return Math.max(0, Math.floor(this.capacity - estimated));
  }

  getResetMs(key: string): number {
     const entry = this.store.get(key);
    if (!entry) return 0;

    const now = Date.now();
    const elapsed = now - entry.currentWindowStart;

    return Math.max(0, this.intervalMs - elapsed);
  }

  cleanUp(): void {
    const now = Date.now();
    const currentWindowIndex = Math.floor(now / this.intervalMs);

    for (const [key, entry] of this.store) {
      
      const entryWindowIndex = Math.floor(
        entry.currentWindowStart / this.intervalMs,
      );

      const windowsPassed = currentWindowIndex - entryWindowIndex;

      if (windowsPassed >= 2) {
        this.store.delete(key);
      }
    }
  }
}
