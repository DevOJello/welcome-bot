const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ CRITICAL: DATABASE_URL is not defined in environment variables!');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // Extra opties om timeouts en netwerkfouten op Render/Supabase te voorkomen
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

// ── Database Initialisatie ────────────────────────────────────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        language TEXT DEFAULT 'en',
        log_channel_id TEXT,
        log_messages BOOLEAN DEFAULT TRUE,
        log_members BOOLEAN DEFAULT TRUE,
        log_profile BOOLEAN DEFAULT TRUE,
        log_voice BOOLEAN DEFAULT TRUE,
        log_roles BOOLEAN DEFAULT TRUE
      )
    `);

    // Kolommen toevoegen voor de zekerheid
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_channel_id TEXT`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_messages BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_members BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_profile BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_voice BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_roles BOOLEAN DEFAULT TRUE`);

    console.log('✅ Database tabellen succesvol geïnitialiseerd via externe database.');
  } catch (err) {
    console.error('❌ Fout bij het initialiseren van de database:', err.message);
  }
}

initDB();

module.exports = pool;
