const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
    const question = interaction.options.getString('question');

    const embed = new EmbedBuilder()
      .setTitle('📊 New Poll')
      .setDescription(`**${question}**\n\n✅ **Yes:** 0\n❌ **No:** 0`)
      .setColor(0x5865F2)
      .setFooter({ text: `Started by ${interaction.user.username}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('poll_yes')
        .setLabel('Yes')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('poll_no')
        .setLabel('No')
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
    const poll = activePolls.get(interaction.message.id);
    if (!poll) {
      return interaction.reply({ content: '⚠️ This poll is no longer active.', flags: 64 });
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
      .setDescription(`**${poll.question}**\n\n✅ **Yes:** ${poll.yes.size}\n❌ **No:** ${poll.no.size}`);

    await interaction.update({ embeds: [updatedEmbed] });
  }
};
