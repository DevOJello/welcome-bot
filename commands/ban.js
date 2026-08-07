const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Permanently ban a user from the server')
    .setDescriptionLocalizations({
      'nl': 'Verban een gebruiker permanent van de server',
      'fr': 'Bannir définitivement un utilisateur du serveur',
      'hi': 'सर्वर से किसी उपयोगकर्ता को स्थायी रूप से प्रतिबंधित करें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to ban')
        .setDescriptionLocalizations({
          'nl': 'De te verbannen gebruiker',
          'fr': 'L\'utilisateur à bannir',
          'hi': 'प्रतिबंध लगाने के लिए उपयोगकर्ता'
        })
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setDescriptionLocalizations({
          'nl': 'Reden voor de ban',
          'fr': 'Raison du bannissement',
          'hi': 'प्रतिबंध का कारण'
        }))
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setDescriptionLocalizations({
          'nl': 'Aantal dagen aan berichten om te verwijderen (0-7)',
          'fr': 'Nombre de jours de messages à supprimer (0-7)',
          'hi': 'हटाए जाने वाले संदेशों के दिनों की संख्या (0-7)'
        })
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