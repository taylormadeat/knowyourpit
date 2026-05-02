import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const frozenTimelineEvents = pgTable(
  "frozen_timeline_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userUniqueIdx: uniqueIndex("frozen_timeline_events_user_unique_idx").on(t.userId),
  }),
);

export type FrozenTimelineEvent = typeof frozenTimelineEvents.$inferSelect;
