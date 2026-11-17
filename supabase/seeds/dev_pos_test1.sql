-- ============================================================
-- Datos DEMO del tenant piloto test1 (POS). SOLO desarrollo/pruebas.
-- Extraído de la sección 10 de 20261019000000_vora_pos_module.sql: una
-- migración no debe sembrar datos ficticios en la base de la plataforma.
-- Ejecutar a mano en una base de desarrollo, después de las migraciones.
-- Idempotente (ON CONFLICT). Requiere el plan Starter y la plantilla retail_ecommerce.
-- ============================================================

-- 10. DATOS SEMILLA PARA EL TENANT PILOTO test1 [mock]

DO $$
DECLARE
  v_plan_id uuid;
  v_template_id uuid;
  v_tenant_id uuid;
  v_branch_ccs uuid;
  v_branch_val uuid;
  v_reg_01 uuid;
  v_reg_02 uuid;
  v_reg_val uuid;
  v_user_maria uuid := '11111111-1111-4111-a111-111111111111'::uuid;
  v_user_luis uuid := '22222222-2222-4222-a222-222222222222'::uuid;
  v_user_carlos uuid := '33333333-3333-4333-a333-333333333333'::uuid;
  v_user_admin uuid := '44444444-4444-4444-a444-444444444444'::uuid;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE name = 'Starter' LIMIT 1;
  SELECT id INTO v_template_id FROM public.business_templates WHERE key = 'retail_ecommerce' LIMIT 1;

  -- 10.1 Tenant test1 [mock]
  INSERT INTO public.tenants (
    commercial_name,
    legal_name,
    tax_id,
    slug,
    infrastructure_mode,
    commercial_status,
    technical_status,
    country,
    currency,
    language,
    timezone,
    business_type,
    business_template_id,
    plan_id,
    wizard_completed
  ) VALUES (
    'test1 [mock]',
    'VORA Retail Piloto test1 C.A. [mock]',
    'J-50123987-1',
    'test1',
    'shared',
    'active',
    'ready',
    'VE',
    'USD',
    'es',
    'America/Caracas',
    'Retail y Comercio Electrónico',
    v_template_id,
    v_plan_id,
    true
  )
  ON CONFLICT (slug) DO UPDATE SET
    commercial_name = EXCLUDED.commercial_name,
    legal_name = EXCLUDED.legal_name,
    commercial_status = 'active',
    technical_status = 'ready',
    country = 'VE',
    currency = 'USD',
    timezone = 'America/Caracas'
  RETURNING id INTO v_tenant_id;

  -- 10.2 Branding test1 [mock] con tokens oficiales VORA
  INSERT INTO public.tenant_branding (
    tenant_id,
    primary_color,
    secondary_color,
    accent_color,
    font_family,
    login_background_color
  ) VALUES (
    v_tenant_id,
    '#285C49',
    '#A9BEA5',
    '#C97857',
    'Inter',
    '#F6F2E9'
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    font_family = EXCLUDED.font_family,
    login_background_color = EXCLUDED.login_background_color;

  -- 10.3 Habilitar commerce.pos en tenant_features
  INSERT INTO public.tenant_features (
    tenant_id,
    feature_key,
    enabled,
    contracted,
    config,
    config_state,
    release_status
  ) VALUES (
    v_tenant_id,
    'commerce.pos',
    true,
    true,
    '{
      "functions": {
        "pos_sales": true,
        "pos_shifts": true,
        "pos_payments": true,
        "pos_returns": true,
        "pos_authorizations": true,
        "pos_documents": true,
        "pos_fiscal": true,
        "pos_kardex": true,
        "pos_settings": true,
        "pos_reports": true
      }
    }'::jsonb,
    'operational',
    'released_for_testing'
  )
  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
    enabled = true,
    contracted = true,
    config = EXCLUDED.config,
    config_state = 'operational',
    release_status = 'released_for_testing';

  -- 10.4 (eliminado) La tasa BCV de prueba no se escribe en platform_exchange_rates:
  --      esa tabla es la fuente real de los cobros de suscripción.

  -- 10.5 Sedes
  INSERT INTO public.tenant_branches (
    tenant_id,
    code,
    name,
    fiscal_address,
    phone,
    is_primary,
    status
  ) VALUES (
    v_tenant_id,
    'CCS-01',
    'Sede Principal Caracas [mock]',
    'Av. Francisco de Miranda, Torre VORA, Nivel PB, Caracas [mock]',
    '+58 212 555 0101',
    true,
    'active'
  )
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_branch_ccs;

  INSERT INTO public.tenant_branches (
    tenant_id,
    code,
    name,
    fiscal_address,
    phone,
    is_primary,
    status
  ) VALUES (
    v_tenant_id,
    'VAL-01',
    'Sucursal Valencia [mock]',
    'Av. Bolívar Norte, C.C. La Granja, Valencia, Carabobo [mock]',
    '+58 241 555 0202',
    false,
    'active'
  )
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_branch_val;

  -- 10.6 Cajas
  INSERT INTO public.pos_registers (
    tenant_id,
    branch_id,
    code,
    name,
    status
  ) VALUES (
    v_tenant_id,
    v_branch_ccs,
    'CAJA-01',
    'Caja 01 - Mostrador Principal [mock]',
    'active'
  )
  ON CONFLICT (tenant_id, branch_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reg_01;

  INSERT INTO public.pos_registers (
    tenant_id,
    branch_id,
    code,
    name,
    status
  ) VALUES (
    v_tenant_id,
    v_branch_ccs,
    'CAJA-02',
    'Caja 02 - Autoservicio [mock]',
    'active'
  )
  ON CONFLICT (tenant_id, branch_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reg_02;

  INSERT INTO public.pos_registers (
    tenant_id,
    branch_id,
    code,
    name,
    status
  ) VALUES (
    v_tenant_id,
    v_branch_val,
    'CAJA-VAL-01',
    'Caja 01 - Sucursal Valencia [mock]',
    'active'
  )
  ON CONFLICT (tenant_id, branch_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reg_val;

  -- 10.7 Asignación de cajeros
  INSERT INTO public.pos_register_assignments (
    tenant_id,
    branch_id,
    register_id,
    auth_user_id,
    cashier_display_name,
    is_active
  ) VALUES
    (v_tenant_id, v_branch_ccs, v_reg_01, v_user_maria, 'María C. [mock]', true),
    (v_tenant_id, v_branch_ccs, v_reg_02, v_user_luis, 'Luis P. [mock]', true);

  -- 10.8 Parámetros de Sede
  INSERT INTO public.pos_settings (
    tenant_id,
    branch_id,
    active_methods,
    max_cashier_discount_percent,
    allow_partial_payments,
    cross_currency_change_enabled,
    internal_doc_prefix,
    next_internal_seq,
    next_sale_seq,
    active_exchange_rate
  ) VALUES (
    v_tenant_id,
    v_branch_ccs,
    ARRAY['efectivo', 'pago_movil', 'tarjeta', 'cashea'],
    5.00,
    true,
    true,
    'COMP-INT-',
    1,
    1259,
    36.500000
  )
  ON CONFLICT (tenant_id, branch_id) DO NOTHING;

  INSERT INTO public.pos_settings (
    tenant_id,
    branch_id,
    active_methods,
    max_cashier_discount_percent,
    allow_partial_payments,
    cross_currency_change_enabled,
    internal_doc_prefix,
    next_internal_seq,
    next_sale_seq,
    active_exchange_rate
  ) VALUES (
    v_tenant_id,
    v_branch_val,
    ARRAY['efectivo', 'pago_movil', 'tarjeta'],
    5.00,
    true,
    true,
    'COMP-VAL-',
    1,
    500,
    36.500000
  )
  ON CONFLICT (tenant_id, branch_id) DO NOTHING;

  -- 10.9 Integración The Factory HKA en Sandbox [mock]
  INSERT INTO public.pos_fiscal_integrations (
    tenant_id,
    provider,
    environment,
    enabled,
    company_rif,
    company_legal_name,
    fiscal_address,
    secret_reference,
    legal_status
  ) VALUES (
    v_tenant_id,
    'HKA',
    'sandbox',
    true,
    'J-50123987-1',
    'VORA Retail Piloto test1 C.A. [mock]',
    'Av. Francisco de Miranda, Torre VORA, Nivel PB, Caracas [mock]',
    'vault:hka_secret_pilot_mock',
    'sandbox_verificado'
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    environment = EXCLUDED.environment,
    enabled = EXCLUDED.enabled,
    legal_status = EXCLUDED.legal_status;

  -- 10.10 Clientes de demostración
  INSERT INTO public.pos_customers (
    tenant_id,
    document_type,
    document_number,
    legal_name,
    phone,
    email,
    fiscal_address,
    customer_tier,
    total_purchases_count,
    total_purchases_usd,
    last_purchase_at
  ) VALUES
    (v_tenant_id, 'V', '18492041', 'Ana López [mock]', '0414-1234567', 'ana.lopez@example.com', 'Urb. Altamira, Av. San Juan Bosco, Caracas [mock]', 'frecuente', 8, 420.00, now() - interval '2 days'),
    (v_tenant_id, 'J', '304928114', 'Carlos Pérez [mock]', '0424-9876543', 'carlos.perez@example.com', 'Colinas de Bello Monte, Calle Beethoven, Caracas [mock]', 'nuevo', 1, 65.00, now() - interval '10 days'),
    (v_tenant_id, 'V', '00000000', 'Consumidor Final [mock]', '0000-0000000', 'consumidor.final@vora.mock', 'Venta en mostrador sin registro fiscal [mock]', 'consumidor_final', 0, 0, null)
  ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    customer_tier = EXCLUDED.customer_tier;

  -- 10.11 Catálogo de productos e inventario de prueba
  INSERT INTO public.pos_products (
    tenant_id,
    branch_id,
    sku,
    barcode,
    name,
    category,
    is_service,
    price_usd,
    tax_rate_percent,
    stock_quantity,
    status
  ) VALUES
    (v_tenant_id, v_branch_ccs, 'CMB-001', '75910010001', 'Camiseta Básica CMB-001 [mock]', 'Ropa', false, 15.0000, 16.00, 45.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'JE-032', '75910010002', 'Pantalón Jean JE-032 [mock]', 'Ropa', false, 38.0000, 16.00, 22.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'ZD-104', '75910010003', 'Zapatos Deportivos ZD-104 [mock]', 'Calzado', false, 55.0000, 16.00, 14.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'PF-801', '75910010004', 'Perfume Floral PF-801 [mock]', 'Perfumería', false, 42.0000, 16.00, 18.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'GC-010', '75910010005', 'Gorra Casual GC-010 [mock]', 'Accesorios', false, 12.0000, 16.00, 30.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'JS-900', '75910010006', 'Juego de Sábanas King JS-900 [mock]', 'Hogar', false, 48.0000, 16.00, 8.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'SA-001', '75910010007', 'Servicio de Ajuste y Sastrería SA-001 [mock]', 'Servicios', true, 8.0000, 16.00, 999.000, 'disponible'),
    (v_tenant_id, v_branch_ccs, 'BE-002', '75910010008', 'Bolsa Ecológica VORA BE-002 [mock]', 'Accesorios', false, 1.5000, 16.00, 120.000, 'disponible'),
    -- Sucursal Valencia
    (v_tenant_id, v_branch_val, 'CMB-001', '75910010001', 'Camiseta Básica CMB-001 [mock]', 'Ropa', false, 15.0000, 16.00, 15.000, 'disponible'),
    (v_tenant_id, v_branch_val, 'JE-032', '75910010002', 'Pantalón Jean JE-032 [mock]', 'Ropa', false, 38.0000, 16.00, 10.000, 'disponible')
  ON CONFLICT (tenant_id, branch_id, sku) DO UPDATE SET
    name = EXCLUDED.name,
    price_usd = EXCLUDED.price_usd,
    stock_quantity = EXCLUDED.stock_quantity;

END $$;

