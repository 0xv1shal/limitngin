# limitngin

A lightweight, zero-dependency, ESM-only rate limiter middleware for
Express.

`limitngin` provides a simple and efficient fixed-interval rate limiting
strategy using an in-memory store. It supports both IP-based and
auth-token--based blocking with standardized RateLimit headers.

Designed for simplicity, performance, and clarity.

------------------------------------------------------------------------

## Installation

npm install limitngin

------------------------------------------------------------------------

## Requirements

-   Node.js 18+
-   Express 4.x or 5.x
-   ESM environment ("type": "module" in package.json)

This package is pure ESM.\
`require()` is not supported.

------------------------------------------------------------------------

## Quick Start (Global Middleware - IP Based)

``` ts
import express from "express";
import limitNgin from "limitngin";

const app = express();

// Apply globally to all routes
app.use(
  limitNgin({
    intervalInSec: 60,
    allowedNoOfRequests: 100
  })
);

app.listen(3000);
```

------------------------------------------------------------------------

## Route-Specific Rate Limiting

You can apply different configurations to different routes.

### Example: Login API (Strict Limit)

``` ts
app.post(
  "/login",
  limitNgin({
    intervalInSec: 60,
    allowedNoOfRequests: 5
  }),
  loginController
);
```

### Example: OTP API (Very Strict Limit)

``` ts
app.post(
  "/send-otp",
  limitNgin({
    intervalInSec: 300,
    allowedNoOfRequests: 3
  }),
  otpController
);
```

### Example: Public API (Relaxed Limit)

``` ts
app.get(
  "/products",
  limitNgin({
    intervalInSec: 60,
    allowedNoOfRequests: 200
  }),
  productsController
);
```

Each route gets its own independent rate-limiting store.

------------------------------------------------------------------------

## Auth Token--Based Limiting

Instead of blocking per IP, you can block per user/session/token.

``` ts
app.use(
  limitNgin({
    intervalInSec: 60,
    allowedNoOfRequests: 5,
    blocks: "auth_token",
    tokenProvider: (req) => {
      return req.headers.authorization ?? "";
    }
  })
);
```

`tokenProvider` must return a unique string identifier per user/session.

------------------------------------------------------------------------

## Configuration

``` ts
type LimitNginConfig =
  | {
      intervalInSec: number;
      allowedNoOfRequests: number;
      customMessage?: string;
      customHeaders?: Record<string, any>;
      blocks?: "ip_addr";
    }
  | {
      intervalInSec: number;
      allowedNoOfRequests: number;
      customMessage?: string;
      customHeaders?: Record<string, any>;
      blocks: "auth_token";
      tokenProvider: (req, res) => string;
    };
```

------------------------------------------------------------------------

## Default Values

intervalInSec: 60\
allowedNoOfRequests: 100\
blocks: "ip_addr"

------------------------------------------------------------------------

## Standard Response Headers

When a request is blocked, the middleware sets:

RateLimit-Limit\
RateLimit-Remaining\
RateLimit-Reset

### Header Details

-   RateLimit-Limit → Maximum allowed requests in interval\
-   RateLimit-Remaining → Remaining requests before blocking\
-   RateLimit-Reset → Seconds remaining before window resets (float)

------------------------------------------------------------------------

## Custom Headers

You can attach additional headers to blocked responses:

``` ts
limitNgin({
  intervalInSec: 60,
  allowedNoOfRequests: 10,
  customHeaders: {
    "X-App-Version": "1.2.3"
  }
});
```

------------------------------------------------------------------------

## Custom Error Message

``` ts
limitNgin({
  intervalInSec: 60,
  allowedNoOfRequests: 10,
  customMessage: "Rate limit exceeded"
});
```

Default response:

``` json
{
  "message": "too many request"
}
```

------------------------------------------------------------------------

## How It Works

The middleware maintains an in-memory store:

`{ <blocking_key>: { req_count: number, created_at: number } }`

The blocking key is either:

-   Client IP address
-   Token returned by `tokenProvider`

Each limiter instance maintains its own independent store.

------------------------------------------------------------------------

## Automatic Cleanup

Expired entries are cleaned periodically:

max(intervalInSec, 60) seconds

------------------------------------------------------------------------

## Limitations

-   In-memory store (not distributed)
-   Not suitable for multi-instance deployments
-   Not recommended for horizontally scaled environments
-   No Redis or external storage support (yet)

For production systems with multiple replicas, use a shared store
solution.

------------------------------------------------------------------------

## Roadmap

-   Retry-After header support
-   Pluggable storage adapters (Redis, etc.)
-   Sliding window strategy
-   Improved cleanup strategy

------------------------------------------------------------------------

## License

MIT
