const pool = require('../database');

/**
 * Fetches the configured language for a specific server.
 * If no language is set, it automatically falls back to English ('en').
 */
async function getGuildLang(guildId) {
  if (!guildId) return 'en';
  try {
    const { rows } = await pool.query(`SELECT language FROM guild_settings WHERE guild_id = $1`, [guildId]);
    return rows[0]?.language || 'en';
  } catch (err) {
    console.error('Error fetching guild language:', err.message);
    return 'en';
  }
}

module.exports = { getGuildLang };