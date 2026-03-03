import { LimitNgin } from "../src/core/limitNgin";

describe("Memory leak detection", () => {
  jest.setTimeout(30000);

  test("does not grow memory after cleanup", async () => {
    if (!global.gc) {
      console.warn("Run with --expose-gc to enable GC");
      return;
    }

    const limiter = new LimitNgin({
      intervalInSec: 1,
      allowedNoOfRequests: 1,
    });

    const initialHeap = process.memoryUsage().heapUsed;

    // Simulate 20k unique keys
    for (let i = 0; i < 20000; i++) {
      limiter.listen(
        { ip: `10.0.0.${i}` } as any,
        {
          set: () => {},
          status: () => ({ json: () => {} }),
          json: () => {},
        } as any,
        () => {},
      );
    }

    // Wait for cleanup interval
    await new Promise((r) => setTimeout(r, 2000));

    global.gc();

    const afterHeap = process.memoryUsage().heapUsed;

    const diffMB = (afterHeap - initialHeap) / 1024 / 1024;

    console.log("Heap diff MB:", diffMB);

    expect(diffMB).toBeLessThan(5);
  });
});