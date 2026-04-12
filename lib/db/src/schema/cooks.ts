import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cooksTable = pgTable("cooks", {
  id: serial("id").primaryKey(),
  grillId: integer("grill_id"),
  foodType: text("food_type").notNull(),
  weightLbs: real("weight_lbs"),
  targetTempF: real("target_temp_f"),
  cookTempF: real("cook_temp_f"),
  status: text("status").notNull().default("planned"),
  plannedStartAt: timestamp("planned_start_at", { withTimezone: true }),
  actualStartAt: timestamp("actual_start_at", { withTimezone: true }),
  plannedEndAt: timestamp("planned_end_at", { withTimezone: true }),
  actualEndAt: timestamp("actual_end_at", { withTimezone: true }),
  notes: text("notes"),
  preheatMinutes: integer("preheat_minutes"),
  wrapAtMinutes: integer("wrap_at_minutes"),
  wrapMethod: text("wrap_method"),
  wrapTempF: integer("wrap_temp_f"),
  wrapReason: text("wrap_reason"),
  restMinutes: integer("rest_minutes"),
  rating: integer("rating"),
  recipeId: integer("recipe_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCookSchema = createInsertSchema(cooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCook = z.infer<typeof insertCookSchema>;
export type Cook = typeof cooksTable.$inferSelect;
