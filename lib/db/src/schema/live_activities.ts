import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const liveActivitiesTable = pgTable("live_activities", {
  activityId: text("activity_id").primaryKey(),
  userId: text("user_id").notNull(),
  cookId: integer("cook_id").notNull(),
  pushToken: text("push_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type LiveActivity = typeof liveActivitiesTable.$inferSelect;
