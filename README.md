# limitngin

A lightweight, zero-dependency **ESM-only** rate limiter middleware for **Express**.  
Implements a simple and efficient fixed-interval request counter using an in-memory store.

The package exports a **default ESM function** that creates a `LimitNgin` instance and returns a ready-to-use Express middleware.

---

## Installation

```bash
npm install limitngin
```

---

## Quick Start (Express — ESM Only)

```ts
import express from "express";
import limitNgin from "limitngin";

const app = express();

app.use(
  limitNgin({
    intervalInSec: 60,
    allowedNoOfRequests: 100
  })
);

app.get("/", (req, res) => {
  res.json({ message: "OK" });
});

app.listen(3000, () => console.log("server running"));
```

> **Note:**  
> This package is **pure ESM**.  
> Use `import` — `require()` is not supported.

---

## API

### Default Export

```ts
limitNgin(config?: LimitNginConfig)
```

Returns an Express middleware function that performs rate limiting.

---

## Configuration

```ts
export type LimitNginConfig = {
  intervalInSec: number;
  allowedNoOfRequests: number;
};
```

### Defaults

```ts
intervalInSec: 60
allowedNoOfRequests: 100
```

---

## How It Works

The middleware maintains a simple in-memory store:

```ts
{
  "<ip>": {
    req_count: number;
    created_at: number;
  }
}
```

---

## Automatic Cleanup

Runs every:

```
max(intervalInSec, 60) seconds
```

---

## Example Blocked Response

```json
{
  "message": "too many request"
}
```

---

## Upcoming Enhancements

- Retry-After header
- Better cleanup
- Pluggable storage adapters
- Framework-agnostic version

---

## License

MIT
