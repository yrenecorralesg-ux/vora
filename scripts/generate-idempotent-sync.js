const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const outputFile = path.join(__dirname, '..', 'supabase', 'sync_schema_idempotent.sql');

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

let consolidated = `-- ============================================================================
-- VORA — Sincronizador de Esquema Idempotente
-- Ejecutable de forma segura: no borra tablas ni datos existentes.
-- Solo crea lo faltante y actualiza funciones/politicas.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
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
console.log(`Generado exitosamente: ${outputFile} (${files.length} migraciones)`);
