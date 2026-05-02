import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cookTemplatesTable = pgTable("cook_templates", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  foodType: text("food_type").notNull(),
  meatCategory: text("meat_category"),
  weightLbs: real("weight_lbs"),
  grillId: integer("grill_id"),
  cookTempF: real("cook_temp_f"),
  targetTempF: real("target_temp_f"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCookTemplateSchema = createInsertSchema(cookTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCookTemplate = z.infer<typeof insertCookTemplateSchema>;
export type CookTemplate = typeof cookTemplatesTable.$inferSelect;
