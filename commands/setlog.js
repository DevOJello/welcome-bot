const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Set the logging channel for server events')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The text channel where logs should be sent')
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
      .setTitle('✅ Logging Channel Configured')
      .setColor(0x00cc66)
      .setDescription(t(lang, 'log_channel_set', { channel: `<#${channel.id}>` }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  }
};
