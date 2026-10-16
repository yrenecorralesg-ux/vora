/*
# EKOSCRM Demo Tenants: SOLEÉ and Empresa Demo

## Overview
Creates two demo tenants with distinct branding, template assignments, and feature flags
to demonstrate white-label capability. Demo identities only — no real commercial data.

## What this creates
1. SOLEÉ tenant — Retail/Ecommerce template, purple+navy branding, full retail modules
2. Empresa Demo tenant — Services template, green branding, service-oriented modules

## Important
- DEMO tenants only, clearly marked
- No real Supabase project connected — connection_status = 'not_configured'
- SOLEÉ branding uses purple (#4a1d6e) + navy per mockups — tenant choice, NOT platform default
*/

DO $$
DECLARE
  v_retail uuid;
  v_services uuid;
  v_starter uuid;
  v_solee_id uuid;
  v_demo_id uuid;
BEGIN
  SELECT id INTO v_retail FROM business_templates WHERE key = 'retail_ecommerce';
  SELECT id INTO v_services FROM business_templates WHERE key = 'services';
  SELECT id INTO v_starter FROM plans WHERE name = 'Starter' LIMIT 1;

  -- SOLEÉ tenant
  INSERT INTO tenants (commercial_name, legal_name, slug, commercial_status, technical_status, country, currency, language, timezone, business_template_id, plan_id, wizard_completed)
  VALUES ('SOLEÉ', 'SOLEÉ S.A.S.', 'solee', 'trial', 'pending_setup', 'Colombia', 'COP', 'es', 'America/Bogota', v_retail, v_starter, true)
  ON CONFLICT (slug) DO UPDATE SET
    commercial_name = EXCLUDED.commercial_name,
    legal_name = EXCLUDED.legal_name,
    business_template_id = EXCLUDED.business_template_id,
    plan_id = EXCLUDED.plan_id,
    wizard_completed = EXCLUDED.wizard_completed,
    updated_at = now()
  RETURNING id INTO v_solee_id;

  -- Empresa Demo tenant
  INSERT INTO tenants (commercial_name, legal_name, slug, commercial_status, technical_status, country, currency, language, timezone, business_template_id, plan_id, wizard_completed)
  VALUES ('Empresa Demo', 'Empresa Demo S.A.S.', 'empresa-demo', 'trial', 'pending_setup', 'Colombia', 'COP', 'es', 'America/Bogota', v_services, v_starter, true)
  ON CONFLICT (slug) DO UPDATE SET
    commercial_name = EXCLUDED.commercial_name,
    legal_name = EXCLUDED.legal_name,
    business_template_id = EXCLUDED.business_template_id,
    plan_id = EXCLUDED.plan_id,
    wizard_completed = EXCLUDED.wizard_completed,
    updated_at = now()
  RETURNING id INTO v_demo_id;

  -- SOLEÉ branding (purple + navy per mockups)
  INSERT INTO tenant_branding (tenant_id, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family, login_background_color, banner_url)
  VALUES (v_solee_id, null, null, '#4a1d6e', '#63DCE5', '#00AFEF', 'Poppins', '#1a0a2e', null)
  ON CONFLICT (tenant_id) DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    font_family = EXCLUDED.font_family,
    login_background_color = EXCLUDED.login_background_color,
    updated_at = now();

  -- Empresa Demo branding (green palette)
  INSERT INTO tenant_branding (tenant_id, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family, login_background_color, banner_url)
  VALUES (v_demo_id, null, null, '#0d7a4e', '#a8e6cf', '#00AFEF', 'Roboto', '#0a4d2e', null)
  ON CONFLICT (tenant_id) DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    font_family = EXCLUDED.font_family,
    login_background_color = EXCLUDED.login_background_color,
    updated_at = now();

  -- SOLEÉ features (retail-focused) — cast enum properly
  INSERT INTO tenant_features (tenant_id, feature_key, enabled, config_state, release_status)
  SELECT v_solee_id, key, true,
    CASE WHEN implementation_status = 'implemented' THEN 'enabled'::feature_config_state ELSE 'pending_config'::feature_config_state END,
    'planned'::release_status
  FROM features
  WHERE key IN ('crm.dashboard','crm.customers','crm.products','crm.sales','crm.orders','crm.tasks','crm.segments','crm.campaigns','capture.fairs','integration.shopify','integration.siigo','analytics.repurchase_pilot','automation.followups','chatbot.guided_web','channel.email')
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    config_state = EXCLUDED.config_state,
    updated_at = now();

  -- Empresa Demo features (services-focused)
  INSERT INTO tenant_features (tenant_id, feature_key, enabled, config_state, release_status)
  SELECT v_demo_id, key, true,
    CASE WHEN implementation_status = 'implemented' THEN 'enabled'::feature_config_state ELSE 'pending_config'::feature_config_state END,
    'planned'::release_status
  FROM features
  WHERE key IN ('crm.dashboard','crm.customers','crm.sales','crm.tasks','crm.segments','channel.email')
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    config_state = EXCLUDED.config_state,
    updated_at = now();

  -- SOLEÉ database (not configured — demo only)
  INSERT INTO tenant_databases (tenant_id, provider, connection_status)
  VALUES (v_solee_id, 'supabase', 'not_configured')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Empresa Demo database
  INSERT INTO tenant_databases (tenant_id, provider, connection_status)
  VALUES (v_demo_id, 'supabase', 'not_configured')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- SOLEÉ subdomain
  INSERT INTO tenant_domains (tenant_id, hostname, domain_type, verification_status, is_primary)
  VALUES (v_solee_id, 'solee.ekoscrm.com', 'subdomain', 'pending', true)
  ON CONFLICT (hostname) DO NOTHING;

  -- Empresa Demo subdomain
  INSERT INTO tenant_domains (tenant_id, hostname, domain_type, verification_status, is_primary)
  VALUES (v_demo_id, 'demo.ekoscrm.com', 'subdomain', 'pending', true)
  ON CONFLICT (hostname) DO NOTHING;
END $$;
