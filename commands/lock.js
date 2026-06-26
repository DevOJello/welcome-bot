const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock or unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Lock a channel so nobody can send messages')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock (leave empty for current channel)').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('open')
        .setDescription('Unlock a channel so everyone can send messages again')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock (leave empty for current channel)').setRequired(false))
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getChannel('channel') || interaction.channel;

    // Get the @everyone role
    const everyoneRole = guild.roles.everyone;

    if (sub === 'channel') {
      try {
        await target.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
        });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('🔒 Channel Locked')
            .setColor(0xff4444)
            .setDescription(`<#${target.id}> has been locked.\nMembers can no longer send messages.`)
            .setFooter({ text: `Locked by ${interaction.user.username}` })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to lock channel:', err.message);
        return interaction.reply({ content: '❌ Failed to lock the channel. Make sure Oscar has the **Manage Channels** permission.', flags: 64 });
      }
    }

    if (sub === 'open') {
      try {
        await target.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null, // null = reset to default (inherit from server)
        });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('🔓 Channel Unlocked')
            .setColor(0x00cc66)
            .setDescription(`<#${target.id}> has been unlocked.\nMembers can send messages again.`)
            .setFooter({ text: `Unlocked by ${interaction.user.username}` })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to unlock channel:', err.message);
        return interaction.reply({ content: '❌ Failed to unlock the channel. Make sure Oscar has the **Manage Channels** permission.', flags: 64 });
      }
    }
  }
};