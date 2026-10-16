/*
# Add business_type column to tenants

## Overview
The tenant creation wizard collects a "business_type" field (e.g. retail, services,
manufacturing, technology, etc.) in step 1 (Empresa). The tenants table did not
have a column to store this value. This migration adds it.

## Changes
- Added column `business_type` (text, nullable) to the `tenants` table.
  Nullable because existing tenants (if any) won't have a value, and it is not
  a required field per business rules — it is informational metadata.

## Security
- No policy changes. The existing tenants RLS policies already cover all columns
  on the table, so the new column inherits the same select/insert/update policies.

## Important Notes
1. Idempotent: uses a DO $$ block with IF NOT EXISTS check.
2. No data loss — this is purely additive.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'business_type'
  ) THEN
    ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS business_type text;
  END IF;
END $$;
