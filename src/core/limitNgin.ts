import { Request, Response, NextFunction } from "express";
import { MemSlidingWindowCounter, MemTokenBucket } from "./mem.algo.js";

type BaseConfig = {
  intervalInSec: number;
  customMessage?: string;
  customHeaders?: Record<string, any>;
};

type TokenBucketAlgoConfig = BaseConfig & {
  algorithm: "token_bucket";
  capacity: number;
};

type SlidingWindowAlgoConfig = BaseConfig & {
  algorithm?: "sliding_window_counter";
  allowedNoOfRequests: number;
};

type IpBlockConfig = BaseConfig & {
  blocks?: "ip_addr"; // default case
  tokenProvider?: never; // not allowed
};

type AuthBlockConfig = BaseConfig & {
  blocks: "auth_token";
  tokenProvider: (req: Request, res: Response) => string;
};

export type LimitNginConfig = BaseConfig &
  (TokenBucketAlgoConfig | SlidingWindowAlgoConfig) &
  (IpBlockConfig | AuthBlockConfig);

export class LimitNgin {
  public config: LimitNginConfig;
  #class: MemTokenBucket | MemSlidingWindowCounter | null = null;

  constructor(config?: LimitNginConfig) {
    const baseConfig: BaseConfig = {
      intervalInSec: config?.intervalInSec ?? 60,
      customMessage: config?.customMessage,
      customHeaders: config?.customHeaders,
    };

    // if algo is not present choose sliding_window_counter
    if (!config?.algorithm || config.algorithm === "sliding_window_counter") {
      this.config = {
        ...baseConfig,
        algorithm: "sliding_window_counter",
        allowedNoOfRequests: config?.allowedNoOfRequests ?? 60,
      };
    } else if (config.algorithm === "token_bucket") {
      this.config = {
        ...baseConfig,
        algorithm: "token_bucket",
        capacity: config.capacity ?? 10,
      };
    } else {
      throw Error("NO PROPER ALGO SELECTED");
    }

    if (!config?.blocks || config.blocks === "ip_addr") {
      this.config = {
        ...this.config,
        blocks: "ip_addr",
      };
    } else {
      if (!config.tokenProvider) throw new Error("TOKEN PROVIDER IS REQUIRED");
      this.config = {
        ...this.config,
        blocks: "auth_token",
        tokenProvider: config.tokenProvider,
      };
    }
  }

  listen(req: Request, res: Response, next: NextFunction) {
    const key = this.#resolveBlockingKey(req, res);
    const algo = this.#resolveAlgorithmClass();

    const blocked = algo.shouldBlock(key);

    const remaining = algo.getRemaining(key);
    const resetMs = algo.getResetMs(key);

    res.set({
      "RateLimit-Limit":
        this.config.algorithm === "sliding_window_counter"
          ? this.config.allowedNoOfRequests
          : this.config.algorithm === "token_bucket"
            ? this.config.capacity
            : 0,
      "RateLimit-Remaining": remaining,
      "RateLimit-Reset": Math.ceil(resetMs / 1000), // spec expects seconds
      ...(blocked && { "Retry-After": Math.ceil(resetMs / 1000) }),
      ...this.config.customHeaders,
    });

    if (blocked) {
      return res.status(429).json({
        message: this.config.customMessage ?? "too many request",
      });
    }

    next();
  }

  #resolveBlockingKey(req: Request, res: Response): string {
    if (this.config.blocks === "ip_addr") {
      return req.ip?.replace("::ffff:", "") ?? "unknown";
    }

    if (!this.config.tokenProvider)
      throw new Error(
        "LIMITNGIN_ERROR: BLOCKS is SET auth_token but no TOKEN_PROVIDER was found",
      );

    return this.config.tokenProvider(req, res);
  }

  #resolveAlgorithmClass(): MemTokenBucket | MemSlidingWindowCounter {
    const intervalMs = this.config.intervalInSec * 1000;
    if (this.config.algorithm === "token_bucket") {
      if (this.#class === null) {
        this.#class = new MemTokenBucket(this.config.capacity, intervalMs);
      }

      return this.#class;
    } else {
      if (this.#class === null) {
        this.#class = new MemSlidingWindowCounter(
          this.config.allowedNoOfRequests,
          intervalMs,
        );
      }

      return this.#class;
    }
  }
}
