ALTER TABLE "cook_checkins"
  ADD COLUMN IF NOT EXISTS "client_operation_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "cook_checkins_cook_client_operation_unique"
  ON "cook_checkins" ("cook_id", "client_operation_id");