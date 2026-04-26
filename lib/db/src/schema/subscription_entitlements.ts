import { pgTable, text, boolean, timestamp, bigint } from "drizzle-orm/pg-core";

export const subscriptionEntitlements = pgTable("subscription_entitlements", {
  userId: text("user_id").primaryKey(),
  isPro: boolean("is_pro").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastEventType: text("last_event_type").notNull(),
  /** Millisecond Unix timestamp of the RevenueCat event that last updated this row.
   *  Used to reject stale/out-of-order webhook deliveries. */
  lastEventAtMs: bigint("last_event_at_ms", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SubscriptionEntitlement = typeof subscriptionEntitlements.$inferSelect;
