import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const aiAnalyzeEvents = pgTable(
  "ai_analyze_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedAtIdx: index("ai_analyze_events_user_created_at_idx").on(t.userId, t.createdAt),
  }),
);

export type AiAnalyzeEvent = typeof aiAnalyzeEvents.$inferSelect;
