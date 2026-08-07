const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logtoggle')
    .setDescription('Enable or disable specific log categories')
    .setDescriptionLocalizations({
      'nl': 'Schakel specifieke logcategorieën in of uit',
      'fr': 'Activer ou désactiver des catégories de journaux spécifiques',
      'hi': 'विशिष्ट लॉग श्रेणियों को सक्षम या अक्षम करें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('The log category to toggle')
        .setDescriptionLocalizations({
          'nl': 'De in- of uitschakelen logcategorie',
          'fr': 'La catégorie de journaux à basculer',
          'hi': 'टogle करने के लिए लॉग श्रेणी'
        })
        .setRequired(true)
        .addChoices(
          { name: '💬 Messages (Delete / Edit)', value: 'log_messages' },
          { name: '👥 Members (Join / Leave)', value: 'log_members' },
          { name: '👤 User Profile (Avatar / Name updates)', value: 'log_profile' },
          { name: '🔊 Voice Channels (Join / Leave / Switch)', value: 'log_voice' },
          { name: '🛡️ Roles & Permissions', value: 'log_roles' }
        )
    )
    .addBooleanOption(option =>
      option
        .setName('enabled')
        .setDescription('True to enable, False to disable')
        .setDescriptionLocalizations({
          'nl': 'True om in te schakelen, False om uit te schakelen',
          'fr': 'True pour activer, False pour désactiver',
          'hi': 'सक्षम करने के लिए True, अक्षम करने के लिए False'
        })
        .setRequired(true)
    ),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const category = interaction.options.getString('category');
    const enabled = interaction.options.getBoolean('enabled');

    // Dynamisch de kolom updaten in PostgreSQL
    await pool.query(
      `INSERT INTO guild_settings (guild_id, ${category}) 
       VALUES ($1, $2) 
       ON CONFLICT (guild_id) DO UPDATE SET ${category} = $2`,
      [interaction.guildId, enabled]
    );

    const statusText = enabled ? '✅ Enabled' : '❌ Disabled';
    
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Log Settings Updated')
      .setColor(enabled ? 0x00cc66 : 0xff4444)
      .setDescription(t(lang, 'log_toggle_success', { category, statusText }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  }
};