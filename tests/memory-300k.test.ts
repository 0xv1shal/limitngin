import { LimitNgin } from "../src/core/limitNgin";

describe("Memory stability after 60s cleanup cycle", () => {
  jest.setTimeout(120000);

  test("does not retain memory after full cleanup cycle (300K keys)", async () => {
    if (!global.gc) {
      console.warn("Run with --expose-gc");
      return;
    }

    const limiter = new LimitNgin({
      intervalInSec: 1,
      allowedNoOfRequests: 1,
    });

    const res = {
      set: () => {},
      status: () => ({ json: () => {} }),
      json: () => {},
    } as any;

    const next = () => {};

    global.gc();
    const initialHeap = process.memoryUsage().heapUsed;

    // Insert 300K keys
    for (let i = 0; i < 300_000; i++) {
      limiter.listen({ ip: `10.0.0.${i}` } as any, res, next);
    }

    // Wait for cleanup cycle (>60s)
    await new Promise((r) => setTimeout(r, 65_000));

    global.gc();
    const afterCleanupHeap = process.memoryUsage().heapUsed;

    const diffMB =
      (afterCleanupHeap - initialHeap) / 1024 / 1024;

    console.log("Initial MB:", initialHeap / 1024 / 1024);
    console.log("After cleanup MB:", afterCleanupHeap / 1024 / 1024);
    console.log("Heap diff MB:", diffMB);

    expect(diffMB).toBeLessThan(10);
  });
});