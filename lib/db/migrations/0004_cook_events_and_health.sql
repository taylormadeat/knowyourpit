CREATE TYPE "public"."cook_event_type" AS ENUM(
  'lid_open',
  'flare_up',
  'spritz',
  'charcoal_add',
  'wood_add',
  'fuel_low',
  'vent_adjust',
  'user_note',
  'proactive_alert',
  'voice_note'
);

CREATE TABLE IF NOT EXISTS "cook_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "cook_id" integer NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
  "event_type" "cook_event_type" NOT NULL,
  "note" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "cooks"
  ADD COLUMN IF NOT EXISTS "finish_time_range_lower" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "finish_time_range_upper" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "health_score" text,
  ADD COLUMN IF NOT EXISTS "health_score_reason" text;
