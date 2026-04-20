import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const meaterCredentialsTable = pgTable("meater_credentials", {
  userId: text("user_id").primaryKey(),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
});

export type MeaterCredentials = typeof meaterCredentialsTable.$inferSelect;
