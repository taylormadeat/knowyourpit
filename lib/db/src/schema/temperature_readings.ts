import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const temperatureReadingsTable = pgTable("temperature_readings", {
  id: serial("id").primaryKey(),
  cookId: integer("cook_id").notNull(),
  grillId: integer("grill_id"),
  probeNumber: integer("probe_number").notNull().default(1),
  probeName: text("probe_name"),
  tempF: real("temp_f").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  source: text("source").notNull().default("manual"),
});

export const insertTemperatureReadingSchema = createInsertSchema(temperatureReadingsTable).omit({ id: true });
export type InsertTemperatureReading = z.infer<typeof insertTemperatureReadingSchema>;
export type TemperatureReading = typeof temperatureReadingsTable.$inferSelect;
