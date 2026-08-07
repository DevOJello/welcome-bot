const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user using their User ID')
    .setDescriptionLocalizations({
      'nl': 'Hef de ban van een gebruiker op via hun gebruikers-ID',
      'fr': 'Débannir un utilisateur en utilisant son ID utilisateur',
      'hi': 'अपनी यूजर आईडी का उपयोग करके किसी उपयोगकर्ता को अनबैन करें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('The Discord User ID to unban')
        .setDescriptionLocalizations({
          'nl': 'De Discord-gebruikers-ID om te ontbannen',
          'fr': 'L\'ID utilisateur Discord à débannir',
          'hi': 'अनबैन करने के लिए डिस्कॉर्ड यूजर आईडी'
        })
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the unban')
        .setDescriptionLocalizations({
          'nl': 'Reden voor het opheffen van de ban',
          'fr': 'Raison du débannissement',
          'hi': 'अनबैन का कारण'
        })),

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
      await interaction.reply({ content: t(lang, 'unban_failed', { id: userId }), flags: 64 });
    }
  },
};