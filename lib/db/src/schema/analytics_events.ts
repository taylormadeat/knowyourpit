import { pgTable, serial, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    event: text("event").notNull(),
    userId: text("user_id"),
    properties: jsonb("properties"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    eventCreatedAtIdx: index("analytics_events_event_created_at_idx").on(t.event, t.createdAt),
    userCreatedAtIdx: index("analytics_events_user_created_at_idx").on(t.userId, t.createdAt),
  }),
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;
