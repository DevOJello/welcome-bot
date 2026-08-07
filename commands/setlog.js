const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Set the logging channel for server events')
    .setDescriptionLocalizations({
      'nl': 'Stel het logkanaal in voor server-evenementen',
      'fr': 'Définir le canal de journalisation pour les événements du serveur',
      'hi': 'सर्वर इवेंट्स के लिए लॉगिंग चैनल सेट करें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The text channel where logs should be sent')
        .setDescriptionLocalizations({
          'nl': 'Het tekstkanaal waar logs naar verzonden moeten worden',
          'fr': 'Le canal textuel où les journaux doivent être envoyés',
          'hi': 'वह टेक्स्ट चैनल जहाँ लॉग भेजे जाने चाहिए'
        })
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const channel = interaction.options.getChannel('channel');

    await pool.query(
      `INSERT INTO guild_settings (guild_id, log_channel_id) 
       VALUES ($1, $2) 
       ON CONFLICT (guild_id) DO UPDATE SET log_channel_id = $2`,
      [interaction.guildId, channel.id]
    );

    const embed = new EmbedBuilder()
      .setTitle(`✅ ${t(lang, 'setlog_title')}`)
      .setColor(0x00cc66)
      .setDescription(t(lang, 'log_channel_set', { channel: `<#${channel.id}>` }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  }
};