const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

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
    const lang = await getGuildLang(interaction.guildId);
    const target = interaction.options.getUser('target');
    const hours = interaction.options.getInteger('duration_hours');
    const reason = interaction.options.getString('reason') || t(lang, 'no_reason_provided');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: t(lang, 'cannot_ban_user'), ephemeral: true });
    }

    await interaction.guild.members.ban(target, { 
      reason: `${t(lang, 'tempban_tag', { hours })}: ${reason}` 
    });

    const embed = new EmbedBuilder()
      .setTitle(`⏳ ${t(lang, 'user_tempbanned_title')}`)
      .setColor(0xff6600)
      .setDescription(t(lang, 'user_tempbanned_desc', { user: target.tag, hours, reason }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    setTimeout(async () => {
      try {
        await interaction.guild.members.unban(target.id, t(lang, 'tempban_expired'));
      } catch (err) {
        console.error(`Failed to automatically unban ${target.id}:`, err);
      }
    }, hours * 60 * 60 * 1000);
  },
};