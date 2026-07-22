const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban and immediately unban a user to clear their recent messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to softban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the softban')),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ Cannot softban this user.', ephemeral: true });
    }

    await interaction.guild.members.ban(target, { 
      reason: `Softban: ${reason}`, 
      deleteMessageSeconds: 7 * 24 * 60 * 60 
    });

    await interaction.guild.members.unban(target.id, `Softban cleanup completed`);

    await interaction.reply({ content: `🧹 **${target.tag}** was softbanned (kicked + messages cleared). | **Reason:** ${reason}` });
  },
};