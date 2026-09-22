const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const targets = [
  ['DATABASE_URL', 'protecedu_dev'],
  ['SHADOW_DATABASE_URL', 'protecedu_shadow'],
  ['TEST_DATABASE_URL', 'protecedu_test'],
];

const parsedTargets = targets.map(([variable, expectedDatabase]) => {
  const value = process.env[variable];

  if (!value) {
    throw new Error(`${variable} is not configured.`);
  }

  const url = new URL(value);
  const database = url.pathname.replace(/^\//, '');

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${variable} must use a PostgreSQL URL.`);
  }

  if (database !== expectedDatabase) {
    throw new Error(`${variable} must target ${expectedDatabase}.`);
  }

  return `${url.hostname}:${url.port || '5432'}/${database}`;
});

if (new Set(parsedTargets).size !== parsedTargets.length) {
  throw new Error('Database targets must be physically distinct.');
}

console.log('PostgreSQL development, shadow, and test targets are distinct.');
