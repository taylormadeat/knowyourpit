import { jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Durable receipts for client-generated live session operations. The receipt is
 * the server-side idempotency boundary: a retry returns the original result,
 * while reusing an operation ID with a different revision is rejected.
 */
export const liveCookSessionOperationsTable = pgTable(
  "live_cook_session_operations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    operationId: text("operation_id").notNull(),
    sessionId: text("session_id").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("live_cook_session_operations_user_operation_idx").on(t.userId, t.operationId),
  ],
);
