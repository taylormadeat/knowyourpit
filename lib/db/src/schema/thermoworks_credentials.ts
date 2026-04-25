import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const thermoworksCredentialsTable = pgTable("thermoworks_credentials", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  thermoworksUserId: text("thermoworks_user_id").notNull(),
  thermoworksAccountId: text("thermoworks_account_id").notNull(),
  projectId: text("project_id").notNull(),
  idToken: text("id_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
});

export type ThermoworksCredentials = typeof thermoworksCredentialsTable.$inferSelect;
