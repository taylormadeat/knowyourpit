import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, forumPostsTable, forumCommentsTable } from "@workspace/db";
import {
  CreateForumPostBody,
  GetForumPostParams,
  LikeForumPostParams,
  CreateForumCommentParams,
  CreateForumCommentBody,
  ListForumPostsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/forum/posts", async (req, res): Promise<void> => {
  const parsed = ListForumPostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category } = parsed.data;
  const conditions = category != null ? [eq(forumPostsTable.category, category)] : [];
  const posts = await db.select().from(forumPostsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${forumPostsTable.createdAt} DESC`);
  res.json(posts);
});

router.post("/forum/posts", async (req, res): Promise<void> => {
  const parsed = CreateForumPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [post] = await db.insert(forumPostsTable).values(parsed.data).returning();
  res.status(201).json(post);
});

router.get("/forum/posts/:id", async (req, res): Promise<void> => {
  const params = GetForumPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [post] = await db.select().from(forumPostsTable).where(eq(forumPostsTable.id, params.data.id));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const comments = await db.select().from(forumCommentsTable)
    .where(eq(forumCommentsTable.postId, params.data.id))
    .orderBy(forumCommentsTable.createdAt);
  res.json({ post, comments });
});

router.patch("/forum/posts/:id/like", async (req, res): Promise<void> => {
  const params = LikeForumPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [post] = await db.update(forumPostsTable)
    .set({ likesCount: sql`${forumPostsTable.likesCount} + 1` })
    .where(eq(forumPostsTable.id, params.data.id))
    .returning();
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

router.post("/forum/posts/:id/comments", async (req, res): Promise<void> => {
  const params = CreateForumCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateForumCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [comment] = await db.insert(forumCommentsTable).values({
    postId: params.data.id,
    ...parsed.data,
  }).returning();
  await db.update(forumPostsTable)
    .set({ commentsCount: sql`${forumPostsTable.commentsCount} + 1` })
    .where(eq(forumPostsTable.id, params.data.id));
  res.status(201).json(comment);
});

export default router;
