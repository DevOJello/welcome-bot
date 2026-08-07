const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban and immediately unban a user to clear their recent messages')
    .setDescriptionLocalizations({
      'nl': 'Verbied een gebruiker en heb direct de ban opgeheven om recente berichten te wissen',
      'fr': 'Bannir et débannir immédiatement un utilisateur pour effacer ses messages récents',
      'hi': 'हाल के संदेशों को साफ़ करने के लिए किसी उपयोगकर्ता को प्रतिबंधित करें और तुरंत अनबैन करें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to softban')
        .setDescriptionLocalizations({
          'nl': 'De te softbannen gebruiker',
          'fr': 'L\'utilisateur à softban',
          'hi': 'सॉफ्टबैन करने के लिए उपयोगकर्ता'
        })
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the softban')
        .setDescriptionLocalizations({
          'nl': 'Reden voor de softban',
          'fr': 'Raison du softban',
          'hi': 'सॉफ्टबैन का कारण'
        })),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || t(lang, 'no_reason_provided');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: t(lang, 'cannot_ban_user'), flags: 64 });
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