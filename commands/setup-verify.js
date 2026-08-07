const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verify_config (
      guild_id TEXT PRIMARY KEY,
      role_ids TEXT[] NOT NULL,
      unverified_role_id TEXT,
      log_channel_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
initDB().catch(err => console.error('❌ Verify DB init error:', err));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('Sets up the advanced verification message in this channel.')
    .setDescriptionLocalizations({
      'nl': 'Stelt het geavanceerde verificatiebericht in dit kanaal in.',
      'fr': 'Configure le message de vérification avancé dans ce canal.',
      'hi': 'इस चैनल में उन्नत सत्यापन संदेश सेट अप करता है।'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt => opt.setName('role1').setDescription('Role to give on verification').setDescriptionLocalizations({ 'nl': 'Rol om te geven bij verificatie', 'fr': 'Rôle à attribuer lors de la vérification', 'hi': 'सत्यापन पर देने के लिए भूमिका' }).setRequired(true))
    .addRoleOption(opt => opt.setName('role2').setDescription('Additional role to give (optional)').setDescriptionLocalizations({ 'nl': 'Extra rol om te geven (optioneel)', 'fr': 'Rôle supplémentaire à attribuer (facultatif)', 'hi': 'देने के लिए अतिरिक्त भूमिका (वैकल्पिक)' }).setRequired(false))
    .addRoleOption(opt => opt.setName('role3').setDescription('Additional role to give (optional)').setDescriptionLocalizations({ 'nl': 'Extra rol om te geven (optioneel)', 'fr': 'Rôle supplémentaire à attribuer (facultatif)', 'hi': 'देने के लिए अतिरिक्त भूमिका (वैकल्पिक)' }).setRequired(false))
    .addRoleOption(opt => opt.setName('unverified_role').setDescription('Role to remove once verified (optional)').setDescriptionLocalizations({ 'nl': 'Rol om te verwijderen na verificatie (optioneel)', 'fr': 'Rôle à retirer une fois vérifié (facultatif)', 'hi': 'सत्यापित होने पर हटाने के लिए भूमिका (वैकल्पिक)' }).setRequired(false))
    .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel to log verifications (optional)').setDescriptionLocalizations({ 'nl': 'Kanaal om verificaties in te loggen (optioneel)', 'fr': 'Canal pour journaliser les vérifications (facultatif)', 'hi': 'सत्यापन लॉग करने के लिए चैनल (वैकल्पिक)' }).setRequired(false)),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);

    const roles = ['role1', 'role2', 'role3']
      .map(key => interaction.options.getRole(key))
      .filter(Boolean);

    const unverifiedRole = interaction.options.getRole('unverified_role');
    const logChannel = interaction.options.getChannel('log_channel');

    await pool.query(`
      INSERT INTO verify_config (guild_id, role_ids, unverified_role_id, log_channel_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id) DO UPDATE SET
        role_ids = $2, unverified_role_id = $3, log_channel_id = $4, updated_at = NOW()
    `, [interaction.guild.id, roles.map(r => r.id), unverifiedRole?.id || null, logChannel?.id || null]);

    const roleList = roles.map(r => `🟢 ${r}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ ${t(lang, 'verify_embed_title')}`)
      .setDescription(t(lang, 'verify_embed_desc', { guild: interaction.guild.name }))
      .setColor(0x2B2D31)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 512 }))
      .addFields({ name: `🔓 ${t(lang, 'verify_roles_header')}`, value: roleList })
      .setFooter({ text: t(lang, 'verify_footer'), iconURL: interaction.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel(t(lang, 'verify_btn_label'))
        .setEmoji('🔐')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({
      content: t(lang, 'verify_setup_success', { count: roles.length }),
      flags: 64
    });
  }
};