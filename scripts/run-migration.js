const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const password = 'AnaisGabriela.11';
  const connectionString = `postgresql://postgres.bpjjuoyizmgyxzubeaag:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  const fallbackUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.bpjjuoyizmgyxzubeaag.supabase.co:5432/postgres`;

  let client;
  try {
    console.log('Connecting via direct pooler/db URL...');
    client = new Client({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Connected successfully via pooler!');
  } catch (err) {
    console.log('Pooler connection failed, trying direct 5432...', err.message);
    client = new Client({
      connectionString: fallbackUrl,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Connected successfully via direct port 5432!');
  }

  const sqlPath = path.join(__dirname, '../supabase/migrations/20261012150000_modular_features_and_functions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing migration 20261012150000_modular_features_and_functions.sql...');
  await client.query(sql);
  console.log('Migration executed successfully!');

  // Verify
  const res = await client.query('SELECT key, name, available_functions FROM features LIMIT 5;');
  console.log('Sample updated features:', res.rows.map(r => ({ key: r.key, funcsCount: (r.available_functions || []).length })));

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
