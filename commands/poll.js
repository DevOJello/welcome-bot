const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
      .setDescription(question)
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

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};