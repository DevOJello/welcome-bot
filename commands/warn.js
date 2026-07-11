const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS warnings (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
initDB().catch(err => console.error('❌ Warn DB init error:', err));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warning system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Give a warning to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Member to warn').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a warning by ID')
        .addIntegerOption(opt => opt.setName('id').setDescription('Warning ID to remove').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View all warnings for a user')
        .addUserOption(opt => opt.setName('user').setDescription('Member to check').setRequired(true))
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const sub = interaction.options.getSubcommand();

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      if (target.id === interaction.user.id) {
        return interaction.reply({ content: '⚠️ You cannot warn yourself.', flags: 64 });
      }
      if (target.bot) {
        return interaction.reply({ content: '⚠️ You cannot warn a bot.', flags: 64 });
      }

      const { rows } = await pool.query(`
        INSERT INTO warnings (guild_id, user_id, staff_id, reason)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [guild.id, target.id, interaction.user.id, reason]);

      const warning = rows[0];

      // Count total warnings for this user
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) FROM warnings WHERE guild_id = $1 AND user_id = $2`,
        [guild.id, target.id]
      );
      const totalWarns = parseInt(countRows[0].count);

      // Track in staff_stats
      try {
        const { incrementStat } = require('./staffstats');
        await incrementStat(interaction.user.id, guild.id, 'warns_given');
      } catch {}

      // Try to DM the warned user
      try {
        await target.send({
          embeds: [new EmbedBuilder()
            .setTitle(`⚠️ You have been warned in ${guild.name}`)
            .setColor(0xff9900)
            .addFields(
              { name: '📝 Reason', value: reason },
              { name: '🔢 Warning ID', value: `#${warning.id}`, inline: true },
              { name: '📊 Total Warnings', value: `${totalWarns}`, inline: true },
            )
            .setTimestamp()]
        });
      } catch {
        // DMs disabled, continue silently
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('⚠️ Warning Issued')
          .setColor(0xff9900)
          .addFields(
            { name: '👤 User', value: `<@${target.id}>`, inline: true },
            { name: '🔢 Warning ID', value: `#${warning.id}`, inline: true },
            { name: '📊 Total Warnings', value: `${totalWarns}`, inline: true },
            { name: '📝 Reason', value: reason },
            { name: '👮 Warned by', value: `<@${interaction.user.id}>`, inline: true },
          )
          .setTimestamp()]
      });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const id = interaction.options.getInteger('id');

      const { rows } = await pool.query(
        `SELECT * FROM warnings WHERE id = $1 AND guild_id = $2`,
        [id, guild.id]
      );

      if (rows.length === 0) {
        return interaction.reply({ content: `⚠️ Warning #${id} not found in this server.`, flags: 64 });
      }

      const warning = rows[0];
      await pool.query(`DELETE FROM warnings WHERE id = $1`, [id]);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🗑️ Warning Removed')
          .setColor(0x00cc66)
          .setDescription(`Warning **#${id}** has been removed.\n\n**User:** <@${warning.user_id}>\n**Reason was:** ${warning.reason}`)
          .setFooter({ text: `Removed by ${interaction.user.username}` })
          .setTimestamp()]
      });
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const target = interaction.options.getUser('user');

      const { rows } = await pool.query(
        `SELECT * FROM warnings WHERE guild_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
        [guild.id, target.id]
      );

      if (rows.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x00cc66)
            .setDescription(`✅ <@${target.id}> has no warnings in this server.`)]
        });
      }

      const lines = rows.map(w =>
        `**#${w.id}** — ${w.reason}\n> By <@${w.staff_id}> • <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>`
      ).join('\n\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`⚠️ Warnings for ${target.username}`)
          .setColor(0xff9900)
          .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 256 }))
          .setDescription(lines.slice(0, 4000))
          .setFooter({ text: `Total: ${rows.length} warning${rows.length !== 1 ? 's' : ''}` })
          .setTimestamp()]
      });
    }
  }
};
