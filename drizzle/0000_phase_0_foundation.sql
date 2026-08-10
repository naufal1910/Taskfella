-- Phase 0 intentionally creates no product tables.
-- This no-op migration establishes repeatable Drizzle migration bookkeeping.
DO $$
BEGIN
  NULL;
END $$;
