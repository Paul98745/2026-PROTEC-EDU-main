require('dotenv').config();

const { Client } = require('pg');

async function checkDatabaseConnection() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('PostgreSQL connection check passed.');
  } finally {
    await client.end();
  }
}

checkDatabaseConnection().catch((error) => {
  console.error(`PostgreSQL connection check failed: ${error.message}`);
  process.exitCode = 1;
});
