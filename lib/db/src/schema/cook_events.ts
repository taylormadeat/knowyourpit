import { pgTable, serial, integer, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cookEventTypeEnum = pgEnum("cook_event_type", [
  "lid_open",
  "flare_up",
  "spritz",
  "mop",
  "charcoal_add",
  "wood_add",
  "fuel_low",
  "vent_adjust",
  "user_note",
  "proactive_alert",
  "voice_note",
  "ai_analysis",
]);

export const cookEvents = pgTable("cook_events", {
  id: serial("id").primaryKey(),
  cookId: integer("cook_id").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  eventType: cookEventTypeEnum("event_type").notNull(),
  note: text("note"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCookEventSchema = createInsertSchema(cookEvents).omit({ id: true, createdAt: true });
export type InsertCookEvent = z.infer<typeof insertCookEventSchema>;
export type CookEvent = typeof cookEvents.$inferSelect;
