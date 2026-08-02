const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

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
    const lang = await getGuildLang(interaction.guildId);
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || t(lang, 'no_reason_provided');

    try {
      await interaction.guild.members.unban(userId, `${reason} (${t(lang, 'unbanned_by', { tag: interaction.user.tag })})`);
      
      const embed = new EmbedBuilder()
        .setTitle(`✅ ${t(lang, 'user_unbanned_title')}`)
        .setColor(0x00cc66)
        .setDescription(t(lang, 'user_unbanned_desc', { id: userId, reason }))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: t(lang, 'unban_failed', { id: userId }), ephemeral: true });
    }
  },
};