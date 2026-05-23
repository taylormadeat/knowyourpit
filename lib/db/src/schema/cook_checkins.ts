import { pgTable, serial, integer, text, real, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const checkinStatusFlagEnum = pgEnum("checkin_status_flag", [
  "all_good",
  "running_behind",
  "flare_up",
  "low_fuel",
]);

export const cookCheckins = pgTable("cook_checkins", {
  id: serial("id").primaryKey(),
  cookId: integer("cook_id").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  firedAt: timestamp("fired_at", { withTimezone: true }),
  internalTempF: real("internal_temp_f"),
  pitTempF: real("pit_temp_f"),
  statusFlag: checkinStatusFlagEnum("status_flag"),
  userNote: text("user_note"),
  photoKey: text("photo_key"),
  aiGuidanceShown: text("ai_guidance_shown"),
  autoDismissed: boolean("auto_dismissed").notNull().default(false),
  isAutomatic: boolean("is_automatic").notNull().default(false),
  probeSource: text("probe_source"),
  phaseLabel: text("phase_label"),
  phaseKey: text("phase_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCookCheckinSchema = createInsertSchema(cookCheckins).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCookCheckin = z.infer<typeof insertCookCheckinSchema>;
export type CookCheckin = typeof cookCheckins.$inferSelect;
