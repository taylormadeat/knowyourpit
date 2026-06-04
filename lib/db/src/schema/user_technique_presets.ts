import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

export const userTechniquePresetsTable = pgTable("user_technique_presets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  cutName: text("cut_name").notNull(),
  label: text("label").notNull(),
  cookMethod: text("cook_method"),
  wrapFinish: text("wrap_finish"),
  spritzFrequency: text("spritz_frequency"),
  injection: text("injection"),
  cookTempF: integer("cook_temp_f"),
  targetTempF: integer("target_temp_f"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("user_technique_presets_user_id_idx").on(t.userId),
  index("user_technique_presets_user_cut_idx").on(t.userId, t.cutName),
]);

export type UserTechniquePreset = typeof userTechniquePresetsTable.$inferSelect;
