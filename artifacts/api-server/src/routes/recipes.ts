import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, recipesTable } from "@workspace/db";
import {
  CreateRecipeBody,
  UpdateRecipeBody,
  GetRecipeParams,
  UpdateRecipeParams,
  DeleteRecipeParams,
  ToggleRecipeFavoriteParams,
  ListRecipesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/recipes", async (req, res): Promise<void> => {
  const parsed = ListRecipesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, search } = parsed.data;
  const conditions = [];
  if (category != null) conditions.push(eq(recipesTable.category, category));
  if (search != null) {
    conditions.push(or(
      ilike(recipesTable.title, `%${search}%`),
      ilike(recipesTable.description, `%${search}%`),
      ilike(recipesTable.tags, `%${search}%`)
    )!);
  }
  const recipes = await db.select().from(recipesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(recipesTable.createdAt);
  res.json(recipes);
});

router.post("/recipes", async (req, res): Promise<void> => {
  const parsed = CreateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [recipe] = await db.insert(recipesTable).values(parsed.data).returning();
  res.status(201).json(recipe);
});

router.get("/recipes/:id", async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, params.data.id));
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.json(recipe);
});

router.patch("/recipes/:id", async (req, res): Promise<void> => {
  const params = UpdateRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const [recipe] = await db.update(recipesTable).set(updateData).where(eq(recipesTable.id, params.data.id)).returning();
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.json(recipe);
});

router.delete("/recipes/:id", async (req, res): Promise<void> => {
  const params = DeleteRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(recipesTable).where(eq(recipesTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch("/recipes/:id/favorite", async (req, res): Promise<void> => {
  const params = ToggleRecipeFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [current] = await db.select({ isFavorite: recipesTable.isFavorite }).from(recipesTable).where(eq(recipesTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  const [recipe] = await db.update(recipesTable).set({ isFavorite: !current.isFavorite }).where(eq(recipesTable.id, params.data.id)).returning();
  res.json(recipe);
});

export default router;
