const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

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
    const lang = await getGuildLang(interaction.guildId);
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || t(lang, 'no_reason_provided');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: t(lang, 'cannot_ban_user'), ephemeral: true });
    }

    await interaction.guild.members.ban(target, { 
      reason: `Softban: ${reason}`, 
      deleteMessageSeconds: 7 * 24 * 60 * 60 
    });

    await interaction.guild.members.unban(target.id, t(lang, 'softban_cleanup'));

    const embed = new EmbedBuilder()
      .setTitle(`🧹 ${t(lang, 'user_softbanned_title')}`)
      .setColor(0xe67e22)
      .setDescription(t(lang, 'user_softbanned_desc', { user: target.tag, reason }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};