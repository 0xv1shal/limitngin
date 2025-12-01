import { Request, Response, NextFunction } from "express";

export type LimitNginConfig = {
  intervalInSec: number;
  allowedNoOfRequests: number;
};

type ReqEntry = {
  req_count: number;
  created_at: number;
};

type ReqMemoryStore = Record<string, ReqEntry>;

export class LimitNgin {
  config: LimitNginConfig;
  #reqMemStore: ReqMemoryStore; // storing requests data in mem

  constructor(config?: LimitNginConfig) {
    this.config = {
    intervalInSec: config?.intervalInSec ?? 60,
    allowedNoOfRequests: config?.allowedNoOfRequests ?? 100,
  };
    this.#reqMemStore = {};

    // cleaning up every interval or sec
    setInterval(()=>this.#cleanup(),Math.max(this.config.intervalInSec,60)*1000)
  }

  listen(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip?.replace("::ffff:", "") ?? "";

    if (this.#shouldBlock(ip)) {
      return res.status(429).json({
        message: "too many request",
      });
    }

    next();
  }

  // will return true if the request needs to be blocked otherwise false
  #shouldBlock(ip: string): boolean {
    const entry = this.#reqMemStore[ip];

    // this will run if a new request has came first time
    if (!entry) {
      this.#reqMemStore[ip] = {
        req_count: 1,
        created_at: Date.now(),
      };
      return false;
    } else {
      const withinInterval =
        this.#calculateTimeDiff(entry.created_at) <
        this.config.intervalInSec; // checks if request has came under the same interval time

      const underLimit =
        entry.req_count< this.config.allowedNoOfRequests &&
        withinInterval;

      if (!withinInterval) {
        // this will run when the time interval is over for a particular req
        this.#reqMemStore[ip] = {
          req_count: 1,
          created_at: Date.now(),
        };
        return false;
      } else if (underLimit) {
        entry.req_count += 1;
        return false;
      } else {
        return true;
      }
    }
  }

  #calculateTimeDiff(created_at: number): number {
    return (Date.now() - created_at) / 1000;
  }

  #cleanup() {
    for (const key in this.#reqMemStore) {
      if (
        (Date.now() - this.#reqMemStore[key]!.created_at) / 1000 >
        this.config.intervalInSec
      ) {
        delete this.#reqMemStore[key];
      }
    }
  }
}
