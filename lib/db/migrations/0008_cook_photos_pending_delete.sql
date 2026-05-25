-- Add pending_delete flag to cook_photos.
-- When a cook is deleted, photos are marked pending_delete=true inside the
-- DB transaction (keeping the row alive). After the transaction, the server
-- deletes the object-storage file then removes the row. If the server crashes
-- between the transaction commit and the storage/row cleanup, this flag lets
-- the cleanup-orphaned-photos admin script find and finish the work.
-- IF NOT EXISTS makes this safe to re-run against databases that already
-- received the column via drizzle-kit push.

ALTER TABLE "cook_photos" ADD COLUMN IF NOT EXISTS "pending_delete" boolean NOT NULL DEFAULT false;
