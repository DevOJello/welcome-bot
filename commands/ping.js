const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency and API response time'),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);

    const sent = await interaction.reply({ content: t(lang, 'pinging'), fetchReply: true });
    
    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x5865F2)
      .addFields(
        { name: `🤖 ${t(lang, 'bot_latency')}`, value: `\`${botLatency}ms\``, inline: true },
        { name: `🌐 ${t(lang, 'api_latency')}`, value: `\`${apiLatency}ms\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};