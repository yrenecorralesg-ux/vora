-- ============================================================================
-- VORA — Verificación de Estado de Tablas en Supabase
-- Ejecuta esto en el SQL Editor de https://supabase.com/dashboard/project/tadnasbbzxrudparnywt/sql
-- ============================================================================

SELECT
  expected.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN 'PRESENTE' ELSE 'FALTA' END AS status
FROM (
  VALUES
    ('business_templates'), ('demo_requests'), ('features'), ('migration_runs'),
    ('plans'), ('platform_audit_logs'), ('platform_billing_settings'), ('platform_exchange_rates'),
    ('platform_invoices'), ('platform_payment_reports'), ('platform_roles'), ('platform_user_roles'),
    ('role_permissions'), ('schema_versions'), ('tenant_branches'), ('tenant_branding'),
    ('tenant_databases'), ('tenant_domains'), ('tenant_features'), ('tenant_invitations'),
    ('tenant_memberships'), ('tenant_role_matrix'), ('tenant_subscriptions'), ('tenant_workspaces'),
    ('tenants'), ('pos_audit_events'), ('pos_authorizations'), ('pos_cash_movements'),
    ('pos_commercial_documents'), ('pos_customers'), ('pos_fiscal_integrations'), ('pos_fiscal_requests'),
    ('pos_inventory_kardex'), ('pos_products'), ('pos_register_assignments'), ('pos_registers'),
    ('pos_return_lines'), ('pos_sale_lines'), ('pos_sale_payments'), ('pos_sale_returns'),
    ('pos_sales'), ('pos_settings'), ('pos_shifts'), ('pos_staff_pins'), ('pos_tenant_settings'),
    ('warehouse_attribute_definitions'), ('warehouse_audit_events'), ('warehouse_balances'),
    ('warehouse_business_profiles'), ('warehouse_categories'), ('warehouse_doc_counters'),
    ('warehouse_document_lines'), ('warehouse_documents'), ('warehouse_import_jobs'),
    ('warehouse_import_rows'), ('warehouse_item_barcodes'), ('warehouse_items'),
    ('warehouse_movements'), ('warehouse_report_schedules'), ('warehouse_settings'),
    ('warehouse_supplier_profiles'), ('warehouse_supplier_terms'), ('warehouse_transfer_lines'),
    ('warehouse_transfers'), ('warehouse_units'), ('warehouse_user_scopes'), ('warehouse_warehouses')
) AS expected(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = expected.table_name
ORDER BY status DESC, expected.table_name ASC;
