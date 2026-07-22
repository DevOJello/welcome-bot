const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user using their User ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('The Discord User ID to unban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the unban')),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.unban(userId, `${reason} (Unbanned by ${interaction.user.tag})`);
      await interaction.reply({ content: `✅ Successfully unbanned user ID \`${userId}\`. | **Reason:** ${reason}` });
    } catch (error) {
      await interaction.reply({ content: `❌ Could not unban user ID \`${userId}\`. Verify the ID is valid and that the user is currently banned.`, ephemeral: true });
    }
  },
};