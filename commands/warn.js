const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

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
    .setDescriptionLocalizations({
      'nl': 'Waarschuwingssysteem',
      'fr': 'Système d\'avertissement',
      'hi': 'चेतावनी प्रणाली'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Give a warning to a member')
        .setDescriptionLocalizations({
          'nl': 'Geef een waarschuwing aan een lid',
          'fr': 'Donner un avertissement à un membre',
          'hi': 'एक सदस्य को चेतावनी दें'
        })
        .addUserOption(opt => opt.setName('user').setDescription('Member to warn').setDescriptionLocalizations({ 'nl': 'Te waarschuwen lid', 'fr': 'Membre à avertir', 'hi': 'चेतावनी देने के लिए सदस्य' }).setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setDescriptionLocalizations({ 'nl': 'Reden voor de waarschuwing', 'fr': 'Raison de l\'avertissement', 'hi': 'चेतावनी का कारण' }).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a warning by ID')
        .setDescriptionLocalizations({
          'nl': 'Verwijder een waarschuwing op ID',
          'fr': 'Supprimer un avertissement par ID',
          'hi': 'आईडी द्वारा चेतावनी हटाएं'
        })
        .addIntegerOption(opt => opt.setName('id').setDescription('Warning ID to remove').setDescriptionLocalizations({ 'nl': 'Te verwijderen waarschuwings-ID', 'fr': 'ID de l\'avertissement à supprimer', 'hi': 'हटाने के लिए चेतावनी आईडी' }).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View all warnings for a user')
        .setDescriptionLocalizations({
          'nl': 'Bekijk alle waarschuwingen voor een gebruiker',
          'fr': 'Afficher tous les avertissements d\'un utilisateur',
          'hi': 'उपयोगकर्ता के लिए सभी चेतावनियाँ देखें'
        })
        .addUserOption(opt => opt.setName('user').setDescription('Member to check').setDescriptionLocalizations({ 'nl': 'Te controleren lid', 'fr': 'Membre à vérifier', 'hi': 'जाँच करने के लिए सदस्य' }).setRequired(true))
    ),

  async execute(interaction, client) {
    const lang = await getGuildLang(interaction.guildId);
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: t(lang, 'guild_only_command'), flags: 64 });

    const sub = interaction.options.getSubcommand();

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      if (target.id === interaction.user.id) {
        return interaction.reply({ content: t(lang, 'warn_cannot_self'), flags: 64 });
      }
      if (target.bot) {
        return interaction.reply({ content: t(lang, 'warn_cannot_bot'), flags: 64 });
      }

      const { rows } = await pool.query(`
        INSERT INTO warnings (guild_id, user_id, staff_id, reason)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [guild.id, target.id, interaction.user.id, reason]);

      const warning = rows[0];

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) FROM warnings WHERE guild_id = $1 AND user_id = $2`,
        [guild.id, target.id]
      );
      const totalWarns = parseInt(countRows[0].count);

      try {
        const { incrementStat } = require('./staffstats');
        await incrementStat(interaction.user.id, guild.id, 'warns_given');
      } catch {}

      try {
        await target.send({
          embeds: [new EmbedBuilder()
            .setTitle(t(lang, 'warn_dm_title', { guild: guild.name }))
            .setColor(0xff9900)
            .addFields(
              { name: `📝 ${t(lang, 'reason')}`, value: reason },
              { name: `🔢 ${t(lang, 'warn_id')}`, value: `#${warning.id}`, inline: true },
              { name: `📊 ${t(lang, 'warn_total')}`, value: `${totalWarns}`, inline: true }
            )
            .setTimestamp()]
        });
      } catch {}

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`⚠️ ${t(lang, 'warn_added_title')}`)
          .setColor(0xff9900)
          .addFields(
            { name: `👤 ${t(lang, 'user')}`, value: `<@${target.id}>`, inline: true },
            { name: `🔢 ${t(lang, 'warn_id')}`, value: `#${warning.id}`, inline: true },
            { name: `📊 ${t(lang, 'warn_total')}`, value: `${totalWarns}`, inline: true },
            { name: `📝 ${t(lang, 'reason')}`, value: reason },
            { name: `👮 ${t(lang, 'warned_by_label')}`, value: `<@${interaction.user.id}>`, inline: true }
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
        return interaction.reply({ content: t(lang, 'warn_not_found', { id }), flags: 64 });
      }

      const warning = rows[0];
      await pool.query(`DELETE FROM warnings WHERE id = $1`, [id]);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`🗑️ ${t(lang, 'warn_removed_title')}`)
          .setColor(0x00cc66)
          .setDescription(t(lang, 'warn_removed_desc', { id, user: warning.user_id, reason: warning.reason }))
          .setFooter({ text: t(lang, 'removed_by', { user: interaction.user.username }) })
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
            .setDescription(t(lang, 'warn_none', { user: target.id }))]
        });
      }

      const lines = rows.map(w =>
        `**#${w.id}** — ${w.reason}\n> ${t(lang, 'warn_line_info', { staff: w.staff_id, time: Math.floor(new Date(w.created_at).getTime() / 1000) })}`
      ).join('\n\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(t(lang, 'warn_list_title', { user: target.username }))
          .setColor(0xff9900)
          .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 256 }))
          .setDescription(lines.slice(0, 4000))
          .setFooter({ text: t(lang, 'warn_list_footer', { count: rows.length }) })
          .setTimestamp()]
      });
    }
  }
};