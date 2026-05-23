-- Add is_automatic and probe_source columns to cook_checkins table.
-- is_automatic: true when the check-in was recorded automatically by the
--   useAutoCheckin hook (probe connected at milestone time), false for all
--   manual check-ins.
-- probe_source: which probe brand provided the temperature reading
--   (e.g. 'meater', 'thermoworks'). Null for manual check-ins.
-- Both columns use IF NOT EXISTS so this migration is safe to re-run against
-- databases that already received the columns via drizzle-kit push.

ALTER TABLE "cook_checkins" ADD COLUMN IF NOT EXISTS "is_automatic" boolean NOT NULL DEFAULT false;
ALTER TABLE "cook_checkins" ADD COLUMN IF NOT EXISTS "probe_source" text;
