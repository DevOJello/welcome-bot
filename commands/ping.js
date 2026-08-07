const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency and API response time')
    .setDescriptionLocalizations({
      'nl': 'Controleer de botlatentie en API-responstijd',
      'fr': 'Vérifier la latence du bot et le temps de réponse de l\'API',
      'hi': 'बॉस की लेटेंसी और API प्रतिक्रिया समय की जाँच करें'
    }),

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