import { LimitNgin } from "../src/core/limitNgin";
import { Request, Response } from "express";

describe("LimitNgin middleware", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2025-01-01T00:00:00Z"));

  let limiter: LimitNgin;

  beforeEach(() => {
    limiter = new LimitNgin({
      intervalInSec: 10,
      allowedNoOfRequests: 3,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  const makeReq = (ip: string) =>
    ({
      ip,
    } as Request);

  const makeRes = () =>
    ({
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response);

  const makeNext = () => jest.fn();

  test("allows first request", () => {
    const req = makeReq("1.1.1.1");
    const res = makeRes();
    const next = makeNext();

    limiter.listen(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("allows up to allowedNoOfRequests", () => {
    const ip = "2.2.2.2";

    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());

    const res = makeRes();
    const next = makeNext();

    limiter.listen(makeReq(ip), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("blocks request exceeding limit", () => {
    const ip = "3.3.3.3";

    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());

    const res = makeRes();
    const next = makeNext();

    limiter.listen(makeReq(ip), res, next);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "RateLimit-Limit": 3,
        "RateLimit-Remaining": 0,
      })
    );

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: "too many request",
    });

    expect(next).not.toHaveBeenCalled();
  });

  test("RateLimit-Reset decreases over time", () => {
    const ip = "4.4.4.4";

    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());

    jest.advanceTimersByTime(5000);

    const res = makeRes();
    limiter.listen(makeReq(ip), res, makeNext());

    const headers = (res.set as jest.Mock).mock.calls[0][0];

    expect(headers["RateLimit-Reset"]).toBeLessThanOrEqual(5);
  });

  test("resets after interval expires", () => {
    const ip = "5.5.5.5";

    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());

    jest.advanceTimersByTime(11000);

    const res = makeRes();
    const next = makeNext();

    limiter.listen(makeReq(ip), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("different IPs are isolated", () => {
    const ip1 = "6.6.6.6";
    const ip2 = "7.7.7.7";

    limiter.listen(makeReq(ip1), makeRes(), makeNext());
    limiter.listen(makeReq(ip1), makeRes(), makeNext());
    limiter.listen(makeReq(ip1), makeRes(), makeNext());
    limiter.listen(makeReq(ip1), makeRes(), makeNext());

    const res = makeRes();
    const next = makeNext();

    limiter.listen(makeReq(ip2), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("removes ::ffff: prefix from IPv6 format", () => {
    const req = makeReq("::ffff:8.8.8.8");
    const res = makeRes();
    const next = makeNext();

    limiter.listen(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test("supports auth_token blocking mode", () => {
    const tokenLimiter = new LimitNgin({
      intervalInSec: 10,
      allowedNoOfRequests: 1,
      blocks: "auth_token",
      tokenProvider: () => "user123",
    });

    tokenLimiter.listen(makeReq("1.1.1.1"), makeRes(), makeNext());

    const res = makeRes();
    const next = makeNext();

    tokenLimiter.listen(makeReq("1.1.1.1"), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  test("applies custom message and headers", () => {
    const customLimiter = new LimitNgin({
      intervalInSec: 10,
      allowedNoOfRequests: 1,
      customMessage: "Rate limit exceeded",
      customHeaders: { "X-Custom": "test" },
    });

    customLimiter.listen(makeReq("9.9.9.9"), makeRes(), makeNext());

    const res = makeRes();

    customLimiter.listen(makeReq("9.9.9.9"), res, makeNext());

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "X-Custom": "test",
      })
    );

    expect(res.json).toHaveBeenCalledWith({
      message: "Rate limit exceeded",
    });
  });
});