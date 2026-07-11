const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete a number of messages from a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to clear (leave empty for current channel)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const amount = interaction.options.getInteger('amount');
    const target = interaction.options.getChannel('channel') || interaction.channel;

    await interaction.deferReply({ flags: 64 });

    try {
      const deleted = await target.bulkDelete(amount, true);

      // Track stat
      try {
        const { incrementStat } = require('./staffstats');
        await incrementStat(interaction.user.id, interaction.guild.id, 'messages_cleared');
      } catch {}

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('🧹 Channel Cleared')
          .setColor(0x5865f2)
          .setDescription(`Deleted **${deleted.size}** message(s) in <#${target.id}>.${deleted.size < amount ? `\n\n⚠️ Some messages were older than 14 days and couldn't be deleted.` : ''}`)
          .setFooter({ text: `Cleared by ${interaction.user.username}` })
          .setTimestamp()]
      });
    } catch (err) {
      console.error('Failed to clear messages:', err.message);
      return interaction.editReply({ content: '❌ Failed to clear messages. Make sure Oscar has the **Manage Messages** permission.' });
    }
  }
};
