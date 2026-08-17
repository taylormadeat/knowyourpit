-- Drop third-party probe cloud credential tables. All stored user
-- credentials/tokens for these removed integrations are purged.
DROP TABLE IF EXISTS "thermoworks_credentials";
DROP TABLE IF EXISTS "meater_credentials";
