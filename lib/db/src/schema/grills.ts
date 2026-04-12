import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const grillsTable = pgTable("grills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  brand: text("brand"),
  model: text("model"),
  cookingSurfaceSqIn: real("cooking_surface_sq_in"),
  maxTempF: real("max_temp_f"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  totalCooks: integer("total_cooks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGrillSchema = createInsertSchema(grillsTable).omit({ id: true, createdAt: true, updatedAt: true, totalCooks: true });
export type InsertGrill = z.infer<typeof insertGrillSchema>;
export type Grill = typeof grillsTable.$inferSelect;
