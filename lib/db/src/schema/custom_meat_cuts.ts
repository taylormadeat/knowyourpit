import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customMeatCutsTable = pgTable("custom_meat_cuts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  targetTempF: real("target_temp_f").notNull(),
  cookTempF: real("cook_temp_f").notNull(),
  minsPerLb: real("mins_per_lb").notNull(),
  restMins: integer("rest_mins").notNull().default(0),
  cookMethod: text("cook_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomMeatCutSchema = createInsertSchema(customMeatCutsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomMeatCut = z.infer<typeof insertCustomMeatCutSchema>;
export type CustomMeatCut = typeof customMeatCutsTable.$inferSelect;
