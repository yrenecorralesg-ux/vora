const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const outputFile = path.join(__dirname, '..', 'supabase', 'sync_missing_pos_warehouse.sql');

// Missing files from POS module onwards
const missingFiles = [
  '20261019000000_vora_pos_module.sql',
  '20261117000000_warehouse_catalog.sql',
  '20261117020000_warehouse_suppliers_schema.sql',
  '20261117030000_warehouse_core_schema.sql',
  '20261117040000_warehouse_naming.sql',
  '20261117050000_remove_mock_exchange_rate.sql',
  '20261121000000_pos_server_persistence.sql',
  '20261121010000_warehouse_mvp_completion.sql',
];

let consolidated = `-- ============================================================================
-- VORA — Esquema Faltante: Módulos POS y Warehouse
-- Aplica las 43 tablas faltantes, funciones, triggers, RLS y permisos.
-- Totalmente idempotente (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

`;

for (const file of missingFiles) {
  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  
  // Transform CREATE TABLE public.foo to CREATE TABLE IF NOT EXISTS public.foo
  content = content.replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ');
  
  // Transform CREATE UNIQUE INDEX to CREATE UNIQUE INDEX IF NOT EXISTS
  content = content.replace(/CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
  
  // Transform CREATE INDEX to CREATE INDEX IF NOT EXISTS
  content = content.replace(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS ');

  consolidated += `\n-- ----------------------------------------------------------------------------\n`;
  consolidated += `-- Migración: ${file}\n`;
  consolidated += `-- ----------------------------------------------------------------------------\n\n`;
  consolidated += content + '\n';
}

fs.writeFileSync(outputFile, consolidated, 'utf8');
console.log(`Generado: ${outputFile}`);
