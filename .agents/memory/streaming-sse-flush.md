---
name: Streaming SSE flush order
description: res.flushHeaders() must be called before any async DB work in NDJSON/SSE streaming routes
---

In Express streaming routes (NDJSON / SSE), always call `res.flushHeaders()` IMMEDIATELY after
setting headers — before any `await` for DB queries or context building. If you await first, the
client sees a blank TCP connection for the entire duration of the DB work (can be 5-15 seconds)
before the first byte arrives.

**Why:** HTTP response headers are buffered by Node/Express until the first write or explicit
flush. Until then the client cannot start rendering a skeleton or loading state.

**How to apply:** Pattern for any streaming endpoint:

```ts
// 1. Validate body (synchronous) — can still 400 here
const parsed = Schema.safeParse(req.body);
if (!parsed.success) { res.status(400).json(...); return; }

// 2. Set headers + flush IMMEDIATELY
res.setHeader("Content-Type", "application/x-ndjson");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("X-Accel-Buffering", "no");
res.flushHeaders();

// 3. Now do async DB work — client already knows stream is open
let ctx;
try {
  ctx = await buildContext(req.userId, parsed.data);
} catch (err) {
  res.write(JSON.stringify({ type: "error", error: "context failed" }) + "\n");
  res.end();
  return;
}
// 4. Stream AI chunks...
```

The `/api/ai/predict/stream` route had this wrong: `buildPredictContext` (7 parallel DB queries,
including smoker fingerprint) was awaited before headers were set, causing 10+ second blank waits.
