import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const webhookEvents = pgTable("webhook_events", {
  messageId: text("message_id").primaryKey(),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
