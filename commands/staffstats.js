const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_stats (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      tickets_closed INTEGER DEFAULT 0,
      messages_cleared INTEGER DEFAULT 0,
      warns_given INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    )
  `);
}
initDB().catch(err => console.error('❌ StaffStats DB init error:', err));

// Helper to increment a stat — called from ticket.js, clear.js, warn.js
async function incrementStat(userId, guildId, field) {
  await pool.query(`
    INSERT INTO staff_stats (user_id, guild_id, ${field})
    VALUES ($1, $2, 1)
    ON CONFLICT (user_id, guild_id) DO UPDATE SET ${field} = staff_stats.${field} + 1
  `, [userId, guildId]);
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
    const target = interaction.options.getUser('target');
    const guildId = interaction.guild.id;

    const { rows } = await pool.query(
      `SELECT * FROM staff_stats WHERE user_id = $1 AND guild_id = $2`,
      [target.id, guildId]
    );

    const stats = rows[0] || { tickets_closed: 0, messages_cleared: 0, warns_given: 0 };

    const embed = new EmbedBuilder()
      .setTitle(`📊 Staff Activity: ${target.username}`)
      .setColor(0x5865F2)
      .setThumbnail(target.displayAvatarURL({ extension: 'png' }))
      .addFields(
        { name: '🎟️ Tickets Closed', value: `\`${stats.tickets_closed}\``, inline: true },
        { name: '🧹 Messages Cleared', value: `\`${stats.messages_cleared}\``, inline: true },
        { name: '⚠️ Warnings Issued', value: `\`${stats.warns_given}\``, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Oscar Management Utility' });

    return interaction.reply({ embeds: [embed] });
  },

  incrementStat,
};
