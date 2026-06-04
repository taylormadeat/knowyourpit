import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const techniquePresetsTable = pgTable("technique_presets", {
  id: serial("id").primaryKey(),
  cutName: text("cut_name").notNull(),
  label: text("label").notNull(),
  cookMethod: text("cook_method"),
  wrapFinish: text("wrap_finish"),
  spritzFrequency: text("spritz_frequency"),
  injection: text("injection"),
  cookTempF: integer("cook_temp_f"),
  targetTempF: integer("target_temp_f"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TechniquePreset = typeof techniquePresetsTable.$inferSelect;
