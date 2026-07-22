const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user for a set amount of hours')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to tempban')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration_hours')
        .setDescription('Duration of the ban in hours')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the temporary ban')),

  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const hours = interaction.options.getInteger('duration_hours');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ Cannot tempban this user.', ephemeral: true });
    }

    await interaction.guild.members.ban(target, { reason: `Tempban (${hours}h): ${reason}` });
    await interaction.reply({ content: `⏳ **${target.tag}** has been temporarily banned for **${hours} hour(s)**. | **Reason:** ${reason}` });

    setTimeout(async () => {
      try {
        await interaction.guild.members.unban(target.id, 'Tempban expired');
      } catch (err) {
        console.error(`Failed to automatically unban ${target.id}:`, err);
      }
    }, hours * 60 * 60 * 1000);
  },
};