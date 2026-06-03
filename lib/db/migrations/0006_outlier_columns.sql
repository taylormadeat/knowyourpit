ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "is_outlier" boolean DEFAULT false NOT NULL;
ALTER TABLE "cooks" ADD COLUMN IF NOT EXISTS "outlier_dismissed" boolean DEFAULT false NOT NULL;
