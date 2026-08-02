const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

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

    const lang = await getGuildLang(guild.id);
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getChannel('channel') || interaction.channel;
    const everyoneRole = guild.roles.everyone;

    if (sub === 'channel') {
      try {
        await target.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
        });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle(t(lang, 'lock_title'))
            .setColor(0xff4444)
            .setDescription(t(lang, 'lock_desc', { channel: target.id }))
            .setFooter({ text: t(lang, 'locked_by', { user: interaction.user.username }) })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to lock channel:', err.message);
        return interaction.reply({ content: t(lang, 'lock_error'), flags: 64 });
      }
    }

    if (sub === 'open') {
      try {
        await target.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
        });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle(t(lang, 'unlock_title'))
            .setColor(0x00cc66)
            .setDescription(t(lang, 'unlock_desc', { channel: target.id }))
            .setFooter({ text: t(lang, 'unlocked_by', { user: interaction.user.username }) })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to unlock channel:', err.message);
        return interaction.reply({ content: t(lang, 'unlock_error'), flags: 64 });
      }
    }
  }
};