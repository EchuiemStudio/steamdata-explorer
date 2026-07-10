// Minimal .env loader shared by the Node data scripts — avoids adding the `dotenv`
// dependency for two env vars. Silently does nothing if .env doesn't exist (e.g. in CI,
// where SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY come from GitHub Actions secrets instead).
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

module.exports = { loadEnv };
