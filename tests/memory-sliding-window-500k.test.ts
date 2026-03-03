import { LimitNgin } from "../src/core/limitNgin";

describe("Memory stability - Sliding Window (500K)", () => {
  jest.setTimeout(180000);

  const createRes = () =>
    ({
      set: () => {},
      status: () => ({ json: () => {} }),
      json: () => {},
    } as any);

  const next = () => {};

  test("shows peak limiter memory and retention behavior", async () => {
    if (!global.gc) {
      console.warn("Run with --expose-gc");
      return;
    }

    const limiter = new LimitNgin({
      intervalInSec: 1,
      algorithm: "sliding_window_counter",
      allowedNoOfRequests: 1,
    });

    const res = createRes();

    global.gc();
    const baseline = process.memoryUsage().heapUsed;

    // ---- Insert 500K keys ----
    for (let i = 0; i < 500_000; i++) {
      limiter.listen({ ip: `172.20.0.${i}` } as any, res, next);
    }

    global.gc();
    const afterInsert = process.memoryUsage().heapUsed;

    const peakLimiterUsageMB =
      (afterInsert - baseline) / 1024 / 1024;

    console.log("Baseline MB:", baseline / 1024 / 1024);
    console.log("After insert MB:", afterInsert / 1024 / 1024);
    console.log("Peak limiter usage MB:", peakLimiterUsageMB);

    // ---- Wait for cleanup ----
    await new Promise((r) => setTimeout(r, 65_000));
    global.gc();

    const afterCleanup = process.memoryUsage().heapUsed;

    const retainedMB =
      (afterCleanup - baseline) / 1024 / 1024;

    console.log("After cleanup MB:", afterCleanup / 1024 / 1024);
    console.log("Retained memory MB:", retainedMB);

    expect(retainedMB).toBeLessThan(15);
  });
});