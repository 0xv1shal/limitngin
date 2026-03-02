import { Request, Response, NextFunction } from "express";

type BaseConfig = {
  intervalInSec: number;
  allowedNoOfRequests: number;
  customMessage?: string;
  customHeaders?: Record<string, any>;
};

type IpBlockConfig = BaseConfig & {
  blocks?: "ip_addr"; // default case
  tokenProvider?: never; // not allowed
};

type AuthBlockConfig = BaseConfig & {
  blocks: "auth_token";
  tokenProvider: (req: Request, res: Response) => string;
};

export type LimitNginConfig = IpBlockConfig | AuthBlockConfig;

type ReqEntry = {
  req_count: number;
  created_at: number;
};

type ReqMemoryStore = Record<string, ReqEntry>;

export class LimitNgin {
  config: LimitNginConfig;
  #reqMemStore: ReqMemoryStore; // storing requests data in mem

  constructor(config?: LimitNginConfig) {
    const resolvedConfig = config ?? {
      intervalInSec: 60,
      allowedNoOfRequests: 100,
      blocks: "ip_addr",
    };

    const baseConfig = {
      intervalInSec: resolvedConfig.intervalInSec ?? 60,
      allowedNoOfRequests: resolvedConfig.allowedNoOfRequests ?? 100,
      customMessage: resolvedConfig.customMessage,
      customHeaders: resolvedConfig.customHeaders,
    };

    if (resolvedConfig.blocks === "auth_token") {
      this.config = {
        ...baseConfig,
        blocks: "auth_token",
        tokenProvider: resolvedConfig.tokenProvider,
      };
    } else {
      this.config = {
        ...baseConfig,
        blocks: "ip_addr",
      };
    }

    this.#reqMemStore = {};

    setInterval(
      () => this.#cleanup(),
      Math.max(this.config.intervalInSec, 60) * 1000,
    );
  }

  listen(req: Request, res: Response, next: NextFunction) {
    let blockingKey: string = "";
    if (this.config.blocks === "ip_addr") {
      blockingKey = req.ip?.replace("::ffff:", "") ?? "";
    } else {
      if (!this.config.tokenProvider)
        throw Error(
          "LIMITNGIN_ERROR: BLOCKS is SET auth_token but no TOKEN_PROVIDER was found",
        );
      blockingKey = this.config.tokenProvider(req, res);
    }

    if (this.#shouldBlock(blockingKey)) {
      res.set({
        "RateLimit-Limit": this.config.allowedNoOfRequests,
        "RateLimit-Remaining":
          this.config.allowedNoOfRequests -
          this.#reqMemStore[blockingKey].req_count,
        "RateLimit-Reset":
          (this.config.intervalInSec * 1000 +
            this.#reqMemStore[blockingKey].created_at -
            Date.now()) /
          1000,
        ...this.config.customHeaders,
      });
      return res.status(429).json({
        message: this.config.customMessage ?? "too many request",
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
        this.#calculateTimeDiff(entry.created_at) < this.config.intervalInSec; // checks if request has came under the same interval time

      const underLimit =
        entry.req_count < this.config.allowedNoOfRequests && withinInterval;

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
