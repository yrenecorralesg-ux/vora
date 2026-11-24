-- ============================================================================
-- VORA — Semilla de Datos Reales: Stunt Riders & Inv. Impacto
-- ============================================================================

-- Tenants
INSERT INTO tenants (id, commercial_name, legal_name, tax_id, slug, country, currency, timezone, commercial_status, technical_status)
VALUES
  ('d3ac2192-b6d7-48e3-8f0d-ee6c12dc3a9a', 'Stunt Riders', 'Stunt Riders C.A.', 'J-12345678-0', 'stunt-riders', 'VE', 'USD', 'America/Caracas', 'active', 'ready'),
  ('f87187a4-50a6-4b3e-bd20-f0d5e79d8a16', 'Inv. Impacto', 'Inversiones Impacto C.A.', 'J-87654321-0', 'inv-impacto', 'VE', 'USD', 'America/Caracas', 'active', 'ready')
ON CONFLICT (id) DO UPDATE SET
  commercial_name = EXCLUDED.commercial_name,
  slug = EXCLUDED.slug,
  commercial_status = EXCLUDED.commercial_status;

-- Branding Stunt Riders
INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, font_family)
VALUES ('d3ac2192-b6d7-48e3-8f0d-ee6c12dc3a9a', '#7a3333', '#1E6B4E', '#A9BEA5', 'Inter')
ON CONFLICT (tenant_id) DO UPDATE SET
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;

-- Branding Inv. Impacto
INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, font_family)
VALUES ('f87187a4-50a6-4b3e-bd20-f0d5e79d8a16', '#3c9f7b', '#1E6B4E', '#A9BEA5', 'Inter')
ON CONFLICT (tenant_id) DO UPDATE SET
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;
