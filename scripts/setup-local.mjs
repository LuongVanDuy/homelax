import fs from 'node:fs';
import crypto from 'node:crypto';

if (fs.existsSync('.env')) {
  console.log('.env already exists; kept unchanged. See .env.example for new settings.');
  process.exit(0);
}
const secret = () => crypto.randomBytes(32).toString('hex');
const databasePassword = secret();
let template = fs.readFileSync('.env.example', 'utf8');
template = template.replaceAll('postgresql://homelax:GENERATE_LOCALLY', `postgresql://homelax:${databasePassword}`)
  .replace('POSTGRES_PASSWORD=GENERATE_LOCALLY', `POSTGRES_PASSWORD=${databasePassword}`)
  .replaceAll('GENERATE_LOCALLY', () => secret());
fs.writeFileSync('.env', template, { flag: 'wx', mode: 0o600 });
console.log('Created .env with unique secrets. Read ADMIN_EMAIL and ADMIN_PASSWORD there to sign in.');
