-- Add actual_thaw_start_at column to cooks table.
-- Records the exact timestamp when the pitmaster moved the meat to begin
-- thawing (set via the "Mark Thaw Started" banner action).
-- Uses IF NOT EXISTS so the migration is safe to run against databases
-- that already have this column (e.g. via drizzle-kit push).

ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "actual_thaw_start_at" timestamp with time zone;
