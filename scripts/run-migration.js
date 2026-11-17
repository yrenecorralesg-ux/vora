// Aplica UNA migración SQL a la base indicada por DATABASE_URL.
// Uso: DATABASE_URL="postgresql://..." node scripts/run-migration.js supabase/migrations/<archivo>.sql
// Nunca escribir credenciales en este archivo.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const file = process.argv[2];
  if (!connectionString) throw new Error('Falta la variable de entorno DATABASE_URL.');
  if (!file) throw new Error('Indica la ruta del archivo .sql a aplicar.');

  const sqlPath = path.resolve(file);
  const sql = fs.readFileSync(sqlPath, 'utf8').replace(/^﻿/, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log(`Ejecutando ${path.basename(sqlPath)}...`);
    await client.query(sql);
    console.log('Migración aplicada.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('La migración falló:', err.message);
  process.exit(1);
});
