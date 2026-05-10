CREATE TYPE "public"."checkin_status_flag" AS ENUM('all_good', 'running_behind', 'flare_up', 'low_fuel');

CREATE TABLE IF NOT EXISTS "cook_checkins" (
  "id" serial PRIMARY KEY NOT NULL,
  "cook_id" integer NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "fired_at" timestamp with time zone,
  "internal_temp_f" real,
  "pit_temp_f" real,
  "status_flag" "checkin_status_flag",
  "user_note" text,
  "photo_key" text,
  "ai_guidance_shown" text,
  "auto_dismissed" boolean NOT NULL DEFAULT false,
  "phase_label" text,
  "phase_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
