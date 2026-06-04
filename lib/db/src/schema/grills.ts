import { pgTable, text, serial, timestamp, integer, real, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const grillsTable = pgTable("grills", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  fuelType: text("fuel_type"),
  brand: text("brand"),
  model: text("model"),
  description: text("description"),
  cookingSurfaceSqIn: real("cooking_surface_sq_in"),
  minTempF: real("min_temp_f"),
  maxTempF: real("max_temp_f"),
  numProbes: integer("num_probes"),
  heatZones: integer("heat_zones"),
  wifiEnabled: boolean("wifi_enabled").default(false),
  hopperSizeLbs: real("hopper_size_lbs"),
  tempRange: text("temp_range"),
  features: text("features").array(),
  notes: text("notes"),
  imageUrl: text("image_url"),
  totalCooks: integer("total_cooks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("grills_user_id_idx").on(t.userId),
]);

export const insertGrillSchema = createInsertSchema(grillsTable).omit({ id: true, createdAt: true, updatedAt: true, totalCooks: true });
export type InsertGrill = z.infer<typeof insertGrillSchema>;
export type Grill = typeof grillsTable.$inferSelect;
