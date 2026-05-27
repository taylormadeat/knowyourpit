-- Merge mop into spritz: copy mop_frequency into spritz_frequency for any
-- cooks where spritz_frequency was not already set, then drop the three
-- deprecated columns (spritz_liquid, mop_frequency, mop_liquid).
-- Safe to re-run: IF EXISTS guards prevent errors on already-applied dbs.

UPDATE "cooks"
SET "spritz_frequency" = "mop_frequency"
WHERE "spritz_frequency" IS NULL
  AND "mop_frequency" IS NOT NULL;

ALTER TABLE "cooks" DROP COLUMN IF EXISTS "spritz_liquid";
ALTER TABLE "cooks" DROP COLUMN IF EXISTS "mop_frequency";
ALTER TABLE "cooks" DROP COLUMN IF EXISTS "mop_liquid";
