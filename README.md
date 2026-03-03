<div align="center">
  <h1>⚡ limitngin ⚡</h1>
  <p><strong>A lean, mean, rate limiting machine for Express</strong></p>
  <p>
    <img src="https://img.shields.io/badge/ESM-module-brightgreen" alt="ESM Module">
    <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="Zero Dependencies">
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node >=18">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
    <img src="https://img.shields.io/badge/TypeScript-ready-blue" alt="TypeScript Ready">
    <img src="https://img.shields.io/badge/benchmark-500k%20requests%20%7C%20~70MB-blue" alt="Benchmark: 500k requests @ ~70MB">
  </p>
  <p>Zero-dependency · Memory-efficient · Type-safe · Pluggable algorithms</p>
  <br>
</div>

---

## 🚀 Why limitngin?

**limitngin** is a lightweight, pure ESM rate limiter middleware for Express that just works. No baggage, no unnecessary dependencies—just clean, predictable rate limiting with two battle-tested algorithms:

- 🪟 **Sliding Window Counter** (default) - Smooth rate limiting without the sharp edges
- 🪣 **Token Bucket** - Perfect for APIs that need to handle bursts

Built for modern Node.js with TypeScript-first design, clear contracts, and memory efficiency in mind.

---

## 🧪 Battle-Tested & Memory Leak Free

We put **limitngin** through its paces with **500,000 requests** under high concurrency:

- 📊 **Peak memory usage**: ~70MB
- 🧹 **Memory released on cleanup**: 100%
- ✅ **Zero memory leaks detected**
- ⚡ **Stable performance under pressure**

The in-memory store with automatic cleanup ensures your application stays lean even under heavy load.

---

## 📦 Installation

```bash
npm install limitngin
```

```bash
yarn add limitngin
```

```bash
pnpm add limitngin
```

> **Note**: This is a pure ESM package. Your project needs `"type": "module"` in package.json. CommonJS `require()` is not supported.

---

## 🎯 Quick Start

Get up and running in seconds with the default sliding window algorithm:

```typescript
import express from "express";
import limitNgin from "limitngin";

const app = express();

// Allow 100 requests per minute globally
app.use(
  limitNgin({
    intervalInSec: 60,
    allowedNoOfRequests: 100
  })
);

app.listen(3000);
```

---

## ⚙️ Complete Configuration Reference

**limitngin** offers type-safe configuration with discriminated unions. Here's every possible configuration option:

### Base Configuration (Always Required)

```typescript
type BaseConfig = {
  intervalInSec: number;           // Time window in seconds
  customMessage?: string;           // Custom error message (default: "too many request")
  customHeaders?: Record<string, any>; // Custom headers to add to responses
};
```

### Algorithm Configuration (Choose One)

#### 1. Sliding Window Counter (Default)
```typescript
type SlidingWindowAlgoConfig = BaseConfig & {
  algorithm?: "sliding_window_counter";  // Can be omitted (default)
  allowedNoOfRequests: number;           // Max requests in the interval
};

// Example:
const config = {
  intervalInSec: 60,
  allowedNoOfRequests: 100,  // 100 requests per minute
  customMessage: "Rate limit exceeded. Try again later."
};
```

#### 2. Token Bucket
```typescript
type TokenBucketAlgoConfig = BaseConfig & {
  algorithm: "token_bucket";  // Must specify token_bucket
  capacity: number;           // Bucket capacity (burst allowance)
};

// Example:
const config = {
  algorithm: "token_bucket",
  intervalInSec: 60,
  capacity: 100,  // 100 requests per minute with burst capability
  customHeaders: { "X-Rate-Limit-Bucket": "token" }
};
```

### Blocking Strategy Configuration (Choose One)

#### 1. IP-Based Blocking (Default)
```typescript
type IpBlockConfig = BaseConfig & {
  blocks?: "ip_addr";           // Can be omitted (default)
  tokenProvider?: never;        // Not allowed with IP blocking
};

// Example:
const config = {
  intervalInSec: 60,
  allowedNoOfRequests: 100,
  blocks: "ip_addr"  // Can omit this line - it's the default
};
```

#### 2. Auth Token-Based Blocking
```typescript
type AuthBlockConfig = BaseConfig & {
  blocks: "auth_token";         // Must specify auth_token
  tokenProvider: (req: Request, res: Response) => string;  // Function to extract token
};

// Example:
const config = {
  intervalInSec: 60,
  allowedNoOfRequests: 5,
  blocks: "auth_token",
  tokenProvider: (req, res) => {
    return req.headers.authorization ?? req.ip; // Fallback to IP
  }
};
```

### Complete Type Definition

```typescript
export type LimitNginConfig = BaseConfig & 
  (TokenBucketAlgoConfig | SlidingWindowAlgoConfig) & 
  (IpBlockConfig | AuthBlockConfig);
```

---

## 📝 Configuration Examples by Use Case

### 🌐 Public API (IP-based, 1000 requests/hour)
```typescript
app.use(
  limitNgin({
    intervalInSec: 3600,  // 1 hour
    allowedNoOfRequests: 1000,
    customMessage: "API rate limit exceeded. Please upgrade your plan.",
    customHeaders: {
      "X-API-Info": "Rate limits reset hourly"
    }
  })
);
```

### 🔐 Login Endpoint (Auth token-based, strict limits)
```typescript
app.post(
  "/login",
  limitNgin({
    algorithm: "token_bucket",  // Allow burst of failed attempts
    intervalInSec: 300,  // 5 minutes
    capacity: 10,  // 10 attempts per 5 minutes
    blocks: "auth_token",
    tokenProvider: (req) => {
      // Rate limit by username/email
      return req.body.email ?? req.ip;
    },
    customMessage: "Too many login attempts. Account temporarily locked."
  }),
  loginController
);
```

### 📱 Mobile API (Mixed strategies)
```typescript
// Global rate limiting by API key
app.use(
  limitNgin({
    algorithm: "sliding_window_counter",
    intervalInSec: 60,
    allowedNoOfRequests: 60,  // 60 requests per minute
    blocks: "auth_token",
    tokenProvider: (req) => {
      return req.headers["x-api-key"] as string;
    }
  })
);

// Stricter limits for sensitive endpoints
app.post(
  "/api/payment",
  limitNgin({
    algorithm: "token_bucket",
    intervalInSec: 60,
    capacity: 5,  // Only 5 payment attempts per minute
    customMessage: "Payment rate limit exceeded. Please wait."
  })
);
```

---

## 🧠 Choose Your Algorithm

### 🪟 Sliding Window Counter (Default)
Smoother rate limiting compared to fixed windows—perfect for most use cases.

```typescript
app.use(
  limitNgin({
    algorithm: "sliding_window_counter",  // Can omit this line
    intervalInSec: 60,
    allowedNoOfRequests: 100
  })
);
```

### 🪣 Token Bucket
Need to handle traffic bursts while maintaining average rate? Token bucket has your back.

```typescript
app.use(
  limitNgin({
    algorithm: "token_bucket",
    intervalInSec: 60,
    capacity: 100  // 100 requests per minute with burst capability
  })
);
```

---

## 🛣️ Route-Specific Limits

Each middleware instance rocks its own independent store. Perfect for different endpoints with different needs:

```typescript
// Strict limits for auth routes
const loginLimiter = limitNgin({
  intervalInSec: 60,
  allowedNoOfRequests: 5,  // Only 5 login attempts per minute
  customMessage: "Too many login attempts"
});

// Generous limits for public API
const apiLimiter = limitNgin({
  intervalInSec: 60,
  allowedNoOfRequests: 1000,
  customHeaders: { "X-Rate-Limit-Tier": "free" }
});

app.post("/login", loginLimiter, loginController);
app.get("/api/public", apiLimiter, publicController);
```

---

## 🔐 Auth Token-Based Limiting

Stop bad actors by their tokens, not just their IPs:

```typescript
app.use(
  limitNgin({
    intervalInSec: 60,
    allowedNoOfRequests: 5,
    blocks: "auth_token",
    tokenProvider: (req) => {
      // Extract user identifier - JWT, API key, session ID, etc.
      return req.headers.authorization ?? 
             req.headers["x-api-key"] ?? 
             req.ip; // Fallback to IP
    }
  })
);
```

---

## 📋 Response Headers

### Standard RateLimit Headers
Every response includes RFC-compliant rate limit headers:

| Header | Description | Example |
|--------|-------------|---------|
| `RateLimit-Limit` | Maximum requests allowed in the interval | `100` |
| `RateLimit-Remaining` | Remaining requests in current window | `42` |
| `RateLimit-Reset` | Seconds until the limit resets | `30` |

### When Rate Limited
Blocked requests receive clear feedback:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 45
Content-Type: application/json

{
  "message": "Too many login attempts. Account temporarily locked."
}
```

---

## 🏗️ How It Works

- **Memory-efficient Map storage** - No bloated data structures
- **Per-instance isolation** - Each limiter operates independently
- **Automatic cleanup** - Stale entries vanish automatically
- **Stable under pressure** - Designed for high key churn scenarios

```typescript
// Each instance maintains its own store
const loginLimiter = limitNgin({ intervalInSec: 60, allowedNoOfRequests: 5 });
const apiLimiter = limitNgin({ intervalInSec: 60, allowedNoOfRequests: 1000 });

// They never interfere with each other
app.use("/login", loginLimiter);
app.use("/api", apiLimiter);
```

---

## ⚡ Performance & Memory

| Metric | Value |
|--------|-------|
| **Peak memory (500k requests)** | ~70 MB |
| **Memory after cleanup** | ~5 MB |
| **Memory leak** | ✅ None detected |
| **Dependencies** | 0 |
| **Bundle size** | Minimal |

---

## ⚠️ Current Limitations

- 🗄️ **In-memory only** - No shared store for distributed deployments
- 🚫 **No Redis adapter** - Yet! (PRs welcome)
- 🔄 **Horizontal scaling** - Each instance maintains its own counters

---

## 🤝 Contributing

Found a bug? Want to add a new algorithm? Contributions are welcome!

1. Fork it
2. Create your feature branch (`git checkout -b feature/amazing-algo`)
3. Commit your changes (`git commit -m 'Add some amazing algo'`)
4. Push to the branch (`git push origin feature/amazing-algo`)
5. Open a Pull Request

---

## 📝 License

MIT © 0xv1shal

---

<div align="center">
  <sub>Built with ❤️ for the OSS community</sub>
</div>
