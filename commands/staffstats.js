const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_stats (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      tickets_closed INTEGER DEFAULT 0,
      messages_cleared INTEGER DEFAULT 0,
      warns_given INTEGER DEFAULT 0,
      bans_issued INTEGER DEFAULT 0,
      kicks_issued INTEGER DEFAULT 0,
      total_ratings INTEGER DEFAULT 0,
      rating_sum INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    )
  `);
  // Backfill columns in case the table already existed from before these fields existed
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS bans_issued INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS kicks_issued INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS rating_sum INTEGER DEFAULT 0`);
}
initDB().catch(err => console.error('❌ StaffStats DB init error:', err));

// Helper to increment a plain counter stat — called from ticket.js, clear.js, warn.js, ban.js, kick.js
async function incrementStat(userId, guildId, field) {
  await pool.query(`
    INSERT INTO staff_stats (user_id, guild_id, ${field})
    VALUES ($1, $2, 1)
    ON CONFLICT (user_id, guild_id) DO UPDATE SET ${field} = staff_stats.${field} + 1
  `, [userId, guildId]);
}

// Helper specifically for star ratings — adds to both the count and the sum
// so the average can be computed later. Called from ticket.js when a rating comes in.
async function addRating(userId, guildId, stars) {
  await pool.query(`
    INSERT INTO staff_stats (user_id, guild_id, total_ratings, rating_sum)
    VALUES ($1, $2, 1, $3)
    ON CONFLICT (user_id, guild_id) DO UPDATE SET
      total_ratings = staff_stats.total_ratings + 1,
      rating_sum = staff_stats.rating_sum + $3
  `, [userId, guildId, stars]);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staffstats')
    .setDescription('View the moderation activity of a staff member.')
    .addUserOption(option =>
      option.setName('target').setDescription('The staff member to check').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const target = interaction.options.getUser('target');
    const guildId = interaction.guild.id;

    const { rows } = await pool.query(
      `SELECT * FROM staff_stats WHERE user_id = $1 AND guild_id = $2`,
      [target.id, guildId]
    );

    const stats = rows[0] || {
      tickets_closed: 0, messages_cleared: 0, warns_given: 0,
      bans_issued: 0, kicks_issued: 0, total_ratings: 0, rating_sum: 0
    };

    const avgRating = stats.total_ratings > 0
      ? (stats.rating_sum / stats.total_ratings).toFixed(2)
      : null;

    const starDisplay = avgRating
      ? `${'⭐'.repeat(Math.round(avgRating))} ${avgRating}/5 (${t(lang, 'staffstats_ratings_count', { count: stats.total_ratings })})`
      : t(lang, 'staffstats_no_ratings');

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${t(lang, 'staffstats_title', { user: target.username })}`)
      .setColor(0x5865F2)
      .setThumbnail(target.displayAvatarURL({ extension: 'png' }))
      .addFields(
        { name: `🎟️ ${t(lang, 'staffstats_tickets')}`, value: `\`${stats.tickets_closed}\``, inline: true },
        { name: `🧹 ${t(lang, 'staffstats_cleared')}`, value: `\`${stats.messages_cleared}\``, inline: true },
        { name: `⚠️ ${t(lang, 'staffstats_warns')}`, value: `\`${stats.warns_given}\``, inline: true },
        { name: `🔨 ${t(lang, 'staffstats_bans')}`, value: `\`${stats.bans_issued}\``, inline: true },
        { name: `👢 ${t(lang, 'staffstats_kicks')}`, value: `\`${stats.kicks_issued}\``, inline: true },
        { name: `⭐ ${t(lang, 'staffstats_ratings')}`, value: starDisplay, inline: false },
      )
      .setTimestamp()
      .setFooter({ text: t(lang, 'staffstats_footer') });

    return interaction.reply({ embeds: [embed] });
  },

  incrementStat,
  addRating,
};