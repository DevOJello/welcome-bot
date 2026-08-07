const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDescriptionLocalizations({
      'nl': 'Verwijder een gebruiker van de server',
      'fr': 'Expulser un utilisateur du serveur',
      'hi': 'सर्वर से किसी उपयोगकर्ता को निकालें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to kick')
        .setDescriptionLocalizations({
          'nl': 'De te kicken gebruiker',
          'fr': 'L\'utilisateur à expulser',
          'hi': 'कick करने के लिए उपयोगकर्ता'
        })
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setDescriptionLocalizations({
          'nl': 'Reden voor de kick',
          'fr': 'Raison de l\'expulsion',
          'hi': 'कick करने का कारण'
        })),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || t(lang, 'no_reason_provided');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: t(lang, 'user_not_in_server'), flags: 64 });
    }

    if (!member.kickable) {
      return interaction.reply({ content: t(lang, 'cannot_kick_user'), flags: 64 });
    }

    await member.kick(`${reason} (${t(lang, 'kicked_by', { tag: interaction.user.tag })})`);
    await interaction.reply({ content: t(lang, 'kick_success', { tag: target.tag, reason }) });
  },
};