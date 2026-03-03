import { LimitNgin } from "../src/core/limitNgin";
import { Request, Response } from "express";

describe("LimitNgin middleware (ms-based)", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2025-01-01T00:00:00Z"));

  const makeReq = (ip: string) =>
    ({ ip } as Request);

  const makeRes = () =>
    ({
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response);

  const makeNext = () => jest.fn();

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe("Token Bucket Algorithm", () => {
    let limiter: LimitNgin;

    beforeEach(() => {
      limiter = new LimitNgin({
        intervalInSec: 10,
        capacity: 3,
        algorithm: "token_bucket",
      });
    });

    test("sets correct headers on successful request", () => {
      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq("1.1.1.1"), res, next);

      const headers = (res.set as jest.Mock).mock.calls[0][0];

      expect(headers["RateLimit-Limit"]).toBe(3);
      expect(headers["RateLimit-Remaining"]).toBe(2);
      expect(headers["RateLimit-Reset"]).toBeGreaterThanOrEqual(0);

      expect(next).toHaveBeenCalled();
    });

    test("blocks after limit exceeded and sets Retry-After", () => {
      const ip = "2.2.2.2";

      limiter.listen(makeReq(ip), makeRes(), makeNext());
      limiter.listen(makeReq(ip), makeRes(), makeNext());
      limiter.listen(makeReq(ip), makeRes(), makeNext());

      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq(ip), res, next);

      const headers = (res.set as jest.Mock).mock.calls[0][0];

      expect(headers["RateLimit-Limit"]).toBe(3);
      expect(headers["RateLimit-Remaining"]).toBe(0);
      expect(headers["Retry-After"]).toBeGreaterThan(0);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    test("refills over time", () => {
      const ip = "3.3.3.3";

      limiter.listen(makeReq(ip), makeRes(), makeNext());
      limiter.listen(makeReq(ip), makeRes(), makeNext());
      limiter.listen(makeReq(ip), makeRes(), makeNext());

      jest.advanceTimersByTime(5000);

      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq(ip), res, next);

      const headers = (res.set as jest.Mock).mock.calls[0][0];

      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Sliding Window Counter Algorithm", () => {
    let limiter: LimitNgin;

    beforeEach(() => {
      limiter = new LimitNgin({
        intervalInSec: 10,
        allowedNoOfRequests: 2,
        algorithm: "sliding_window_counter",
      });
    });

    test("blocks strictly within window", () => {
      const ip = "4.4.4.4";

      limiter.listen(makeReq(ip), makeRes(), makeNext());
      limiter.listen(makeReq(ip), makeRes(), makeNext());

      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq(ip), res, next);

      const headers = (res.set as jest.Mock).mock.calls[0][0];

      expect(headers["RateLimit-Limit"]).toBe(2);
      expect(headers["RateLimit-Remaining"]).toBe(0);
      expect(headers["Retry-After"]).toBeGreaterThan(0);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    test("resets after full interval passes", () => {
      const ip = "5.5.5.5";

      limiter.listen(makeReq(ip), makeRes(), makeNext());
      limiter.listen(makeReq(ip), makeRes(), makeNext());

      jest.advanceTimersByTime(21000);

      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq(ip), res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("General Behavior", () => {
    test("isolates different IPs", () => {
      const limiter = new LimitNgin({
        intervalInSec: 10,
        allowedNoOfRequests: 1,
      });

      limiter.listen(makeReq("6.6.6.6"), makeRes(), makeNext());

      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq("7.7.7.7"), res, next);

      expect(next).toHaveBeenCalled();
    });

    test("removes ::ffff prefix", () => {
      const limiter = new LimitNgin({
        intervalInSec: 10,
        allowedNoOfRequests: 1,
      });

      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq("::ffff:8.8.8.8"), res, next);

      expect(next).toHaveBeenCalled();
    });

    test("supports auth_token mode", () => {
      const limiter = new LimitNgin({
        intervalInSec: 10,
        allowedNoOfRequests: 1,
        blocks: "auth_token",
        tokenProvider: () => "user-1",
      });

      limiter.listen(makeReq("1.1.1.1"), makeRes(), makeNext());

      const res = makeRes();
      const next = makeNext();

      limiter.listen(makeReq("1.1.1.1"), res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    test("applies custom message and headers", () => {
      const limiter = new LimitNgin({
        intervalInSec: 10,
        allowedNoOfRequests: 1,
        customMessage: "Rate limit exceeded",
        customHeaders: { "X-Test": "ok" },
      });

      limiter.listen(makeReq("9.9.9.9"), makeRes(), makeNext());

      const res = makeRes();

      limiter.listen(makeReq("9.9.9.9"), res, makeNext());

      const headers = (res.set as jest.Mock).mock.calls[0][0];

      expect(headers["X-Test"]).toBe("ok");
      expect(res.json).toHaveBeenCalledWith({
        message: "Rate limit exceeded",
      });
    });
  });
});