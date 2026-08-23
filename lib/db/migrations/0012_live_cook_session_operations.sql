CREATE TABLE IF NOT EXISTS "live_cook_session_operations" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "operation_id" text NOT NULL,
  "session_id" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "response" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_cook_session_operations_user_operation_idx"
  ON "live_cook_session_operations" USING btree ("user_id", "operation_id");