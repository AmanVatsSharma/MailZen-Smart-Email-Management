-- scripts/db/seed-plans-labels.sql
-- Lightweight SQL seed for billing plans + system labels.
-- The full demo seed (user, workspace, inboxes, etc.) is run via:
--     cd apps/backend && npm run seed:demo:fresh
-- This file is the fast-path for setting up the *minimum* rows required to
-- boot the backend without TypeORM synchronize complaining.

-- ---------------------------------------------------------------------------
-- 1. Billing plans
-- ---------------------------------------------------------------------------
INSERT INTO plans (id, name, slug, "priceMonthly", "priceYearly", "aiCreditsPerMonth", features, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Free', 'free', 0, 0, 100, '["inbox","basic_search"]'::jsonb, true, NOW(), NOW()),
  (gen_random_uuid(), 'Pro', 'pro', 1200, 12000, 5000, '["inbox","smart_replies","email_tracking","automations"]'::jsonb, true, NOW(), NOW()),
  (gen_random_uuid(), 'Business', 'business', 4900, 49000, 25000, '["inbox","smart_replies","email_tracking","automations","team_workspaces","unified_inbox"]'::jsonb, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE
  SET "priceMonthly" = EXCLUDED."priceMonthly",
      "priceYearly" = EXCLUDED."priceYearly",
      "aiCreditsPerMonth" = EXCLUDED."aiCreditsPerMonth",
      features = EXCLUDED.features,
      "updatedAt" = NOW();

-- ---------------------------------------------------------------------------
-- 2. System feature flags
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (id, key, description, "isEnabled", "rolloutPercent", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'email_warmup', 'Enable email warmup feature', true, 100, NOW(), NOW()),
  (gen_random_uuid(), 'smart_replies', 'Enable AI smart replies', true, 100, NOW(), NOW()),
  (gen_random_uuid(), 'email_tracking', 'Enable email open/click tracking', true, 100, NOW(), NOW()),
  (gen_random_uuid(), 'automations', 'Enable workspace automations', true, 100, NOW(), NOW()),
  (gen_random_uuid(), 'unified_inbox', 'Enable unified inbox across providers', true, 100, NOW(), NOW()),
  (gen_random_uuid(), 'sender_intelligence', 'Enable sender behavior analytics', true, 100, NOW(), NOW())
ON CONFLICT (key) DO UPDATE
  SET "isEnabled" = EXCLUDED."isEnabled",
      "rolloutPercent" = EXCLUDED."rolloutPercent",
      "updatedAt" = NOW();

-- ---------------------------------------------------------------------------
-- 3. Done
-- ---------------------------------------------------------------------------
SELECT 'Seeded ' || COUNT(*) || ' plans' AS status FROM plans;
SELECT 'Seeded ' || COUNT(*) || ' feature flags' AS status FROM feature_flags;
