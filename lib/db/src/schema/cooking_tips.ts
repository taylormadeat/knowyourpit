import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cookingTipsTable = pgTable("cooking_tips", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull().default("beginner"),
  imageUrl: text("image_url"),
});

export const insertCookingTipSchema = createInsertSchema(cookingTipsTable).omit({ id: true });
export type InsertCookingTip = z.infer<typeof insertCookingTipSchema>;
export type CookingTip = typeof cookingTipsTable.$inferSelect;
