import { LimitNgin } from "../src/core/limitNgin";

describe("LimitNgin middleware", () => {
  jest.useFakeTimers();

  const limiter = new LimitNgin({
    intervalInSec: 10,
    allowedNoOfRequests: 3,
  });

  const makeReq = (ip: string) => ({ ip } as any);

  const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const makeNext = () => jest.fn();

  test("allows first request", () => {
    const req = makeReq("1.1.1.1");
    const res = makeRes();
    const next = makeNext();

    limiter.listen(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("blocks the 4th request within interval", () => {
    const ip = "2.2.2.2";

    // 3 allowed
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());

    // 4th blocked
    const res = makeRes();
    const next = makeNext();

    limiter.listen(makeReq(ip), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ message: "too many request" });
    expect(next).not.toHaveBeenCalled();
  });

  test("resets after interval expires", () => {
    const ip = "3.3.3.3";

    // exceed limit
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());
    limiter.listen(makeReq(ip), makeRes(), makeNext());

    // advance time beyond interval
    jest.advanceTimersByTime(11000);

    const res = makeRes();
    const next = makeNext();

    limiter.listen(makeReq(ip), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
