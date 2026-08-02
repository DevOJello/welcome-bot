const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Database Initialisatie ────────────────────────────────────────────────────
async function initDB() {
  try {
    // 1. Maak de guild_settings tabel aan voor taal- en loginstellingen
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

    // 2. Kolommen toevoegen als de tabel al bestond (veiligheidshalve)
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en'`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_channel_id TEXT`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_messages BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_members BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_profile BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_voice BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_roles BOOLEAN DEFAULT TRUE`);

    console.log('✅ Database tabellen succesvol geïnitialiseerd.');
  } catch (err) {
    console.error('❌ Fout bij het initialiseren van de database:', err.message);
  }
}

// Draai de initialisatie zodra de database geladen wordt
initDB();

module.exports = pool;
