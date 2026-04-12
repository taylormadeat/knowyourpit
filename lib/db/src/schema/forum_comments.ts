import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const forumCommentsTable = pgTable("forum_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  content: text("content").notNull(),
  authorName: text("author_name").notNull(),
  authorAvatar: text("author_avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertForumCommentSchema = createInsertSchema(forumCommentsTable).omit({ id: true, createdAt: true });
export type InsertForumComment = z.infer<typeof insertForumCommentSchema>;
export type ForumComment = typeof forumCommentsTable.$inferSelect;
