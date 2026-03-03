import { LimitNgin } from "../src/core/limitNgin";

describe("Memory stability - Token Bucket (500K)", () => {
  jest.setTimeout(180000);

  const createRes = () =>
    ({
      set: () => {},
      status: () => ({ json: () => {} }),
      json: () => {},
    } as any);

  const next = () => {};

  test("no memory retention after cleanup cycles", async () => {
    if (!global.gc) {
      console.warn("Run with --expose-gc");
      return;
    }

    const limiter = new LimitNgin({
      intervalInSec: 1,
      algorithm: "token_bucket",
      capacity: 1,
    });

    const res = createRes();

    global.gc();
    const baseline = process.memoryUsage().heapUsed;

    // ---- Cycle 1 ----
    for (let i = 0; i < 500_000; i++) {
      limiter.listen({ ip: `172.16.0.${i}` } as any, res, next);
    }

    await new Promise((r) => setTimeout(r, 65_000));
    global.gc();

    const afterFirst = process.memoryUsage().heapUsed;

    // ---- Cycle 2 ----
    for (let i = 0; i < 500_000; i++) {
      limiter.listen({ ip: `10.0.1.${i}` } as any, res, next);
    }

    await new Promise((r) => setTimeout(r, 65_000));
    global.gc();

    const afterSecond = process.memoryUsage().heapUsed;

    const diffFirst =
      (afterFirst - baseline) / 1024 / 1024;
    const diffSecond =
      (afterSecond - baseline) / 1024 / 1024;

    console.log("Baseline MB:", baseline / 1024 / 1024);
    console.log("After first cleanup MB:", afterFirst / 1024 / 1024);
    console.log("After second cleanup MB:", afterSecond / 1024 / 1024);
    console.log("Diff first MB:", diffFirst);
    console.log("Diff second MB:", diffSecond);

    expect(diffFirst).toBeLessThan(15);
    expect(diffSecond).toBeLessThan(15);
  });
});