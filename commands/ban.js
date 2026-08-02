const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Permanently ban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban'))
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || t(lang, 'no_reason_provided');
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: t(lang, 'cannot_ban_user'), flags: 64 });
    }

    await interaction.guild.members.ban(target, { 
      reason: `${reason} (${t(lang, 'banned_by', { tag: interaction.user.tag })})`, 
      deleteMessageSeconds: deleteDays * 24 * 60 * 60 
    });

    await interaction.reply({ content: t(lang, 'ban_success', { tag: target.tag, reason }) });
  },
};