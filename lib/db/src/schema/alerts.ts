import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  cookId: integer("cook_id"),
  probeNumber: integer("probe_number"),
  alertType: text("alert_type").notNull(),
  thresholdTempF: real("threshold_temp_f").notNull(),
  message: text("message").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }),
  scheduledNotificationId: text("scheduled_notification_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true, triggeredAt: true, isActive: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
