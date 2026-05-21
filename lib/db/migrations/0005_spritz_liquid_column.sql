-- Add spritz_liquid column to cooks table.
-- Uses IF NOT EXISTS so the migration is safe to run against databases
-- that already have this column (e.g. via drizzle-kit push).

ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "spritz_liquid" text;
