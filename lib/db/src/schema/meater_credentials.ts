import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const meaterCredentialsTable = pgTable("meater_credentials", {
  userId: text("user_id").primaryKey(),
  accessToken: text("access_token").notNull(),
  tokenStoredAt: timestamp("token_stored_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MeaterCredentials = typeof meaterCredentialsTable.$inferSelect;
