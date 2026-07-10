// Shared service-role Supabase client for the Node data scripts (never used client-side —
// scripts/supabase-client.js is the separate, anon-key, browser-facing client).
const { loadEnv } = require('./load-env');
const { createClient } = require('@supabase/supabase-js');

function getSupabaseAdmin() {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env locally, GitHub Actions secrets in CI).');
  }
  return createClient(url, key);
}

module.exports = { getSupabaseAdmin };
