import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import multer from "multer";
import { randomUUID } from "crypto";
import { db, cookPhotosTable, cooksTable } from "@workspace/db";
import {
  ListCookPhotosParams,
  UploadCookPhotoParams,
  DeleteCookPhotoParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();

const MAX_PHOTOS_PER_COOK = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SIGNED_URL_TTL_SEC = 3600;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

async function getSignedUrl(storageKey: string): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
  const request = {
    bucket_name: bucketId,
    object_name: storageKey,
    method: "GET",
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to sign object URL: ${response.status}`);
  }
  const json = await response.json() as { signed_url: string };
  return json.signed_url;
}

async function uploadToStorage(buffer: Buffer, mimeType: string): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const objectName = `cook-photos/${randomUUID()}.${ext}`;
  const bucket = objectStorageClient.bucket(bucketId);
  const file = bucket.file(objectName);
  await file.save(buffer, {
    contentType: mimeType,
    metadata: { cacheControl: "private, max-age=3600" },
  });
  return objectName;
}

async function deleteFromStorage(storageKey: string): Promise<void> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) return;
  const bucket = objectStorageClient.bucket(bucketId);
  await bucket.file(storageKey).delete({ ignoreNotFound: true });
}

router.get("/cooks/:id/photos", requireAuth, async (req: any, res): Promise<void> => {
  const params = ListCookPhotosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid cook id" });
    return;
  }
  const { id: cookId } = params.data;

  const [cook] = await db.select({ id: cooksTable.id })
    .from(cooksTable)
    .where(and(eq(cooksTable.id, cookId), eq(cooksTable.userId, req.userId)));
  if (!cook) { res.status(404).json({ error: "Cook not found" }); return; }

  const photos = await db.select().from(cookPhotosTable)
    .where(and(eq(cookPhotosTable.cookId, cookId), eq(cookPhotosTable.userId, req.userId)))
    .orderBy(cookPhotosTable.createdAt);

  const result = await Promise.all(photos.map(async (p) => {
    let signedUrl: string | null = null;
    try { signedUrl = await getSignedUrl(p.storageKey); } catch { /* ignore */ }
    return { ...p, signedUrl };
  }));

  res.json(result);
});

router.post(
  "/cooks/:id/photos",
  requireAuth,
  (req: any, res: any, next: any) => {
    upload.single("photo")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "File too large (max 10 MB)" });
        } else {
          res.status(400).json({ error: err.message ?? "Upload error" });
        }
        return;
      }
      next();
    });
  },
  async (req: any, res: any): Promise<void> => {
    const params = UploadCookPhotoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid cook id" });
      return;
    }
    const { id: cookId } = params.data;

    if (!req.file) { res.status(400).json({ error: "No photo file provided" }); return; }

    const [cook] = await db.select({ id: cooksTable.id })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, cookId), eq(cooksTable.userId, req.userId)));
    if (!cook) { res.status(404).json({ error: "Cook not found" }); return; }

    const [{ photoCount }] = await db
      .select({ photoCount: count() })
      .from(cookPhotosTable)
      .where(and(eq(cookPhotosTable.cookId, cookId), eq(cookPhotosTable.userId, req.userId)));

    if (Number(photoCount) >= MAX_PHOTOS_PER_COOK) {
      res.status(400).json({ error: `Maximum ${MAX_PHOTOS_PER_COOK} photos per cook allowed` });
      return;
    }

    let storageKey: string;
    try {
      storageKey = await uploadToStorage(req.file.buffer, req.file.mimetype);
    } catch (err: any) {
      req.log.error({ err: err.message }, "Failed to upload photo to storage");
      res.status(500).json({ error: "Failed to upload photo" });
      return;
    }

    const takenAtRaw = req.body?.takenAt;
    const takenAt = takenAtRaw ? new Date(takenAtRaw) : null;

    const [photo] = await db.insert(cookPhotosTable).values({
      cookId,
      userId: req.userId,
      storageKey,
      takenAt: takenAt ?? undefined,
    }).returning();

    let signedUrl: string | null = null;
    try { signedUrl = await getSignedUrl(storageKey); } catch { /* ignore */ }

    res.status(201).json({ ...photo, signedUrl });
  }
);

router.delete("/cooks/:id/photos/:photoId", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteCookPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { id: cookId, photoId } = params.data;

  const [photo] = await db.select().from(cookPhotosTable)
    .where(and(
      eq(cookPhotosTable.id, photoId),
      eq(cookPhotosTable.cookId, cookId),
      eq(cookPhotosTable.userId, req.userId),
    ));
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  await deleteFromStorage(photo.storageKey);
  await db.delete(cookPhotosTable).where(eq(cookPhotosTable.id, photoId));

  res.sendStatus(204);
});

export { deleteFromStorage };
export default router;
