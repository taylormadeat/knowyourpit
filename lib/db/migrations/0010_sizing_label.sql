-- Add sizing_label column to cooks table.
-- Stores the human-readable size description chosen at planning/log time
-- (e.g. "6 thighs · ≈ 2.4 lbs est." or "2 racks · ≈ 4.5 lbs est.").
-- Safe to re-run: IF NOT EXISTS prevents duplicate-column errors.
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "sizing_label" text;
