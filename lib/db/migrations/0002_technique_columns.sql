-- Add technique quick-pick columns to cooks table.
-- Uses IF NOT EXISTS so the migration is safe to run against databases
-- that already have these columns (e.g. via drizzle-kit push).

ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "cooking_method" text;
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "injection" text;
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "spritz_frequency" text;
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "wrap_finish" text;
