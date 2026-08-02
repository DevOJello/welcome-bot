const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

// In-memory store voor polls: messageId -> { yes: Set, no: Set, question, author }
const activePolls = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Start a poll in the channel')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('The question you want people to vote on')
        .setRequired(true)),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const question = interaction.options.getString('question');

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${t(lang, 'poll_title')}`)
      .setDescription(`**${question}**\n\n✅ **${t(lang, 'poll_yes')}:** 0\n❌ **${t(lang, 'poll_no')}:** 0`)
      .setColor(0x5865F2)
      .setFooter({ text: t(lang, 'poll_footer', { user: interaction.user.username }) })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('poll_yes')
        .setLabel(t(lang, 'poll_yes'))
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('poll_no')
        .setLabel(t(lang, 'poll_no'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    // Sla de poll state op
    activePolls.set(response.id, {
      question,
      author: interaction.user.username,
      yes: new Set(),
      no: new Set()
    });
  },

  async handleButton(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const poll = activePolls.get(interaction.message.id);
    if (!poll) {
      return interaction.reply({ content: t(lang, 'poll_inactive'), flags: 64 });
    }

    const userId = interaction.user.id;

    if (interaction.customId === 'poll_yes') {
      if (poll.yes.has(userId)) {
        poll.yes.delete(userId); // Stem intrekken
      } else {
        poll.yes.add(userId);
        poll.no.delete(userId); // Verwijderen uit No als ze switchten
      }
    } else if (interaction.customId === 'poll_no') {
      if (poll.no.has(userId)) {
        poll.no.delete(userId); // Stem intrekken
      } else {
        poll.no.add(userId);
        poll.yes.delete(userId); // Verwijderen uit Yes als ze switchten
      }
    }

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setTitle(`📊 ${t(lang, 'poll_title')}`)
      .setDescription(`**${poll.question}**\n\n✅ **${t(lang, 'poll_yes')}:** ${poll.yes.size}\n❌ **${t(lang, 'poll_no')}:** ${poll.no.size}`);

    await interaction.update({ embeds: [updatedEmbed] });
  }
};