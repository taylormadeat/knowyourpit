-- Add KCBS competition scoring columns and team count to cooks table.
-- Uses IF NOT EXISTS so the migration is safe to run against databases
-- that already have these columns (e.g. via drizzle-kit push).

ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "competition_team_count" integer;
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "judge_score_appearance" real;
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "judge_score_taste" real;
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "judge_score_texture" real;
