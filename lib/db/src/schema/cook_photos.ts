import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cookPhotosTable = pgTable("cook_photos", {
  id: serial("id").primaryKey(),
  cookId: integer("cook_id").notNull(),
  userId: text("user_id").notNull(),
  storageKey: text("storage_key").notNull(),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCookPhotoSchema = createInsertSchema(cookPhotosTable).omit({ id: true, createdAt: true });
export type InsertCookPhoto = z.infer<typeof insertCookPhotoSchema>;
export type CookPhoto = typeof cookPhotosTable.$inferSelect;
